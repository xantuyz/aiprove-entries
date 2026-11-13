#!/bin/sh
for n in 1000000 5000000; do
  echo "== N=$n =="
  echo -n "table (./primes):        "; /usr/bin/time -f "%e s" sh -c "echo $n | ./primes >/dev/null" 2>&1 | tr '\n' ' '; echo
  echo -n "table (static):          "; /usr/bin/time -f "%e s" sh -c "echo $n | ./primes-static >/dev/null" 2>&1 | tr '\n' ' '; echo
  echo -n "table (run.sh):          "; /usr/bin/time -f "%e s" sh -c "echo $n | ./run.sh >/dev/null" 2>&1 | tr '\n' ' '; echo
  echo -n "sieve fallback (no tbl): "; mkdir -p /tmp/nop && cp primes /tmp/nop/ && /usr/bin/time -f "%e s" sh -c "echo $n | (cd /tmp/nop && ./primes) >/dev/null" 2>&1 | tr '\n' ' '; echo
done
