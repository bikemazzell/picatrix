#!/bin/sh
set -eu

mkdir -p local/picatrix
pdftotext reference/Picatrix/Picatrix_A_Medieval_Treatise_on_Astral_Magic_2020.pdf local/picatrix/attrell.txt
wc -l -c local/picatrix/attrell.txt
