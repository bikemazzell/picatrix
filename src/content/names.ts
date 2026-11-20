import type { AspectAngle, Planet } from '../astro'

export const SIGN_NAMES: readonly string[] = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]

export const MANSION_NAMES: readonly string[] = [
  'Al-Sharatain',
  'Al-Butain',
  'Al-Thurayya',
  'Al-Dabaran',
  'Al-Haqa',
  'Al-Hana',
  'Al-Dhira',
  'Al-Nathrah',
  'Al-Tarf',
  'Al-Jabhah',
  'Al-Zubrah',
  'Al-Sarfah',
  'Al-Awwa',
  'Al-Simak',
  'Al-Ghafr',
  'Al-Zubana',
  'Al-Iklil',
  'Al-Qalb',
  'Al-Shaulah',
  "Al-Na'am",
  'Al-Baldah',
  "Sa'd al-Dhabih",
  "Sa'd Bula",
  "Sa'd al-Su'ud",
  "Sa'd al-Akhbiyah",
  'Al Fargh al-Awwal',
  'Al Fargh al-Thani',
  'Batn al-Hut',
]

export const PLANET_NAMES: Record<Planet, string> = {
  Sun: 'Sun',
  Mercury: 'Mercury',
  Venus: 'Venus',
  Mars: 'Mars',
  Jupiter: 'Jupiter',
  Saturn: 'Saturn',
  Uranus: 'Uranus',
  Neptune: 'Neptune',
  Pluto: 'Pluto',
}

export const ASPECT_NAMES: Record<AspectAngle, string> = {
  0: 'Conjunction',
  60: 'Sextile',
  90: 'Square',
  120: 'Trine',
  180: 'Opposition',
}
