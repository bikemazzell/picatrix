"""Reference event generator: Skyfield + JPL DE440s.

Emits one JSON file per calendar year holding the Moon's phase quarters,
sign and mansion ingresses, exact aspects to the nine planets, and
Mercury's stations, as UTC unix seconds rounded to the second.
"""

import argparse
import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from skyfield.api import load, load_file
from skyfield.framelib import ecliptic_frame
from skyfield.searchlib import find_discrete

HERE = Path(__file__).resolve().parent
BSP_PATH = HERE / 'de440s.bsp'
DEFAULT_OUT = HERE.parent.parent / 'tests' / 'fixtures' / 'reference'

PLANETS = ('Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto')
BSP_NAMES = {
    'Sun': 'sun',
    'Mercury': 'mercury',
    'Venus': 'venus',
    'Mars': 'mars barycenter',
    'Jupiter': 'jupiter barycenter',
    'Saturn': 'saturn barycenter',
    'Uranus': 'uranus barycenter',
    'Neptune': 'neptune barycenter',
    'Pluto': 'pluto barycenter',
}
MANSION_WIDTH = 360.0 / 28.0
MOON_STEP_DAYS = 0.25
MERCURY_STEP_DAYS = 1.0
MERCURY_HALF_SPAN_DAYS = 0.05
ASPECT_BOUNDARIES = np.array((0.0, 60.0, 90.0, 120.0, 180.0, 240.0, 270.0, 300.0))
ANGLE_OF_SECTOR = (0, 60, 90, 120, 180, 120, 90, 60)
KINDS = ('phase', 'sign', 'mansion', 'aspect', 'mercury')
MIN_YEAR = 1850
MAX_YEAR = 2149
SELFCHECK_WINDOWS = (
    ((2026, 11, 9), (2026, 11, 11)),
    ((2026, 11, 12), (2026, 11, 14)),
    ((2026, 11, 19), (2026, 11, 21)),
)

TS = None
EARTH = None
MOON = None
PLANET_BODIES = {}


def load_ephemeris():
    global TS, EARTH, MOON, PLANET_BODIES
    if TS is not None:
        return
    TS = load.timescale()
    eph = load_file(str(BSP_PATH))
    EARTH = eph['earth']
    MOON = eph['moon']
    PLANET_BODIES = {name: eph[key] for name, key in BSP_NAMES.items()}


def apparent_longitude(body, t):
    return EARTH.at(t).observe(body).apparent().frame_latlon(ecliptic_frame)[1].degrees


def moon_sign(t):
    return (np.floor(apparent_longitude(MOON, t) / 30.0) % 12).astype(int)


def moon_mansion(t):
    return (np.floor(apparent_longitude(MOON, t) / MANSION_WIDTH) % 28).astype(int)


def moon_phase_quarter(t):
    elongation = (apparent_longitude(MOON, t) - apparent_longitude(PLANET_BODIES['Sun'], t)) % 360.0
    return (np.floor(elongation / 90.0) % 4).astype(int)


def aspect_sector(d):
    return np.searchsorted(ASPECT_BOUNDARIES, d, side='right') - 1


def make_aspect_predicate(body):
    def moon_aspect(t):
        d = (apparent_longitude(MOON, t) - apparent_longitude(body, t)) % 360.0
        return aspect_sector(d)
    return moon_aspect


def mercury_direct(t):
    back = TS.tt_jd(t.tt - MERCURY_HALF_SPAN_DAYS)
    ahead = TS.tt_jd(t.tt + MERCURY_HALF_SPAN_DAYS)
    delta = apparent_longitude(PLANET_BODIES['Mercury'], ahead) - apparent_longitude(PLANET_BODIES['Mercury'], back)
    delta = np.where(delta > 180.0, delta - 360.0, np.where(delta < -180.0, delta + 360.0, delta))
    return (delta > 0.0).astype(int)


moon_sign.step_days = MOON_STEP_DAYS
moon_mansion.step_days = MOON_STEP_DAYS
moon_phase_quarter.step_days = MOON_STEP_DAYS
mercury_direct.step_days = MERCURY_STEP_DAYS


def phase_code(v):
    return v


def sign_code(v):
    return v


def mansion_code(v):
    return v + 1


def mercury_code(v):
    return 'R' if v == 0 else 'D'


def build_searches(include_aspects=True):
    searches = [
        ('phase', moon_phase_quarter, phase_code),
        ('sign', moon_sign, sign_code),
        ('mansion', moon_mansion, mansion_code),
    ]
    if include_aspects:
        for planet in PLANETS:
            predicate = make_aspect_predicate(PLANET_BODIES[planet])
            predicate.__name__ = f'moon_aspect_{planet.lower()}'
            predicate.step_days = MOON_STEP_DAYS
            searches.append(('aspect', predicate, lambda v, p=planet: f'{p}-{ANGLE_OF_SECTOR[v]}'))
    searches.append(('mercury', mercury_direct, mercury_code))
    return searches


def year_window(year):
    start = datetime(year, 1, 1, tzinfo=timezone.utc)
    end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    return TS.from_datetime(start), TS.from_datetime(end)


def discrete_events(predicate, t0, t1, to_code):
    times, values = find_discrete(t0, t1, predicate)
    rows = []
    for t, v in zip(times, values):
        dt = t.utc_datetime()
        if t0.utc_datetime() <= dt < t1.utc_datetime():
            rows.append((int(round(dt.timestamp())), to_code(int(v))))
    return rows


def generate_year(year, include_aspects=True):
    load_ephemeris()
    t0, t1 = year_window(year)
    rows = []
    for kind, predicate, to_code in build_searches(include_aspects):
        for unix, code in discrete_events(predicate, t0, t1, to_code):
            rows.append((unix, kind, code))
    rows.sort(key=lambda r: (r[0], r[1], str(r[2])))
    kinds = [k for k in KINDS if include_aspects or k != 'aspect']
    coverage = {
        'start': t0.utc_datetime().isoformat().replace('+00:00', 'Z'),
        'end': t1.utc_datetime().isoformat().replace('+00:00', 'Z'),
        'kinds': kinds,
    }
    events = [[kind, code, unix] for unix, kind, code in rows]
    return {'coverage': coverage, 'events': events}


def brute_force_events(predicate, t0, t1, to_code):
    jd = np.arange(t0.tt, t1.tt, 1.0 / 1440.0)
    times = TS.tt_jd(jd)
    values = predicate(times)
    changes = np.flatnonzero(values[:-1] != values[1:])
    dts = times.utc_datetime()
    return [(int(round(dts[i + 1].timestamp())), to_code(int(values[i + 1]))) for i in changes]


def selfcheck():
    load_ephemeris()
    failures = 0
    total = 0
    for (d0, d1) in SELFCHECK_WINDOWS:
        t0 = TS.from_datetime(datetime(*d0, tzinfo=timezone.utc))
        t1 = TS.from_datetime(datetime(*d1, tzinfo=timezone.utc))
        print(f'window {d0} .. {d1}')
        for kind, predicate, to_code in build_searches():
            found = discrete_events(predicate, t0, t1, to_code)
            brute = brute_force_events(predicate, t0, t1, to_code)
            total += len(found)
            problems = []
            if len(found) != len(brute):
                problems.append(f'count find_discrete={len(found)} brute={len(brute)}')
                problems.append(f'  find_discrete: {found}')
                problems.append(f'  brute force:   {brute}')
            else:
                for (fu, fc), (bu, bc) in zip(found, brute):
                    if fc != bc:
                        problems.append(f'code {fc} != {bc}')
                    elif not 0 <= bu - fu <= 61:
                        problems.append(f'time drift {bu - fu}s for code {fc}')
            if problems:
                failures += 1
                print(f'  {kind}: FAIL')
                for p in problems[:8]:
                    print(f'    {p}')
            else:
                print(f'  {kind}: {len(found)} events match')
    if failures:
        print(f'selfcheck FAILED: {failures} predicate(s) mismatched')
        return 1
    print(f'selfcheck passed: {total} events verified against 1-minute brute force')
    return 0


def main(start_year: int, end_year: int, out_dir: Path, include_aspects: bool = True, jobs: int = 4):
    if not MIN_YEAR <= start_year <= end_year <= MAX_YEAR:
        raise SystemExit(f'years must satisfy {MIN_YEAR} <= start <= end <= {MAX_YEAR} (DE440s coverage)')
    out_dir.mkdir(parents=True, exist_ok=True)
    years = list(range(start_year, end_year + 1))
    started = time.monotonic()
    if jobs > 1 and len(years) > 1:
        with ProcessPoolExecutor(max_workers=jobs, initializer=load_ephemeris) as pool:
            results = pool.map(generate_year, years, [include_aspects] * len(years))
            for year, data in zip(years, results):
                write_year(out_dir, year, data)
    else:
        load_ephemeris()
        for year in years:
            write_year(out_dir, year, generate_year(year, include_aspects))
    elapsed = time.monotonic() - started
    print(f'{len(years)} year(s) in {elapsed / 60:.1f} min')


def write_year(out_dir, year, data):
    path = out_dir / f'{year}.json'
    path.write_text(json.dumps(data, separators=(',', ':')) + '\n')
    print(f'{year}: {len(data["events"])} events -> {path}')


def cli():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('start', type=int, nargs='?', help='first year, inclusive')
    parser.add_argument('end', type=int, nargs='?', help='last year, inclusive')
    parser.add_argument('--selfcheck', action='store_true', help='compare find_discrete with brute force')
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT, help='output directory')
    parser.add_argument('--no-aspects', action='store_true', help='skip Moon aspects')
    parser.add_argument('--jobs', type=int, default=4, help='parallel year processes')
    args = parser.parse_args()
    if args.selfcheck:
        sys.exit(selfcheck())
    if args.start is None or args.end is None:
        parser.error('start and end year are required unless --selfcheck')
    main(args.start, args.end, args.out, include_aspects=not args.no_aspects, jobs=args.jobs)


if __name__ == '__main__':
    cli()
