#!/bin/sh
# Run command for fastest-primes: ./run.sh < N
# Prefers the prebuilt static binary; falls back to building from primes.c.
cd "$(dirname "$0")"
if [ -x ./primes-static ]; then exec ./primes-static; fi
if [ -x ./primes ]; then exec ./primes; fi
cc -O3 -o primes primes.c && exec ./primes
