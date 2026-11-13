# Generate pi_table.bin: uint32 LE pi(n) for n = 0..5_000_000 (sieve of Eratosthenes, odd-only)
import struct, sys
N = 5_000_000
is_comp = bytearray(N + 1)
is_comp[0] = is_comp[1] = 1
import math
for p in range(2, int(math.isqrt(N)) + 1):
    if not is_comp[p]:
        step = p
        start = p * p
        is_comp[start:N+1:step] = b'\x01' * ((N - start)//step + 1)
pi = 0
out = bytearray()
for n in range(N + 1):
    if not is_comp[n]:
        pi += 1
    out += struct.pack('<I', pi)
with open('pi_table.bin', 'wb') as f:
    f.write(out)
print('pi(5000000) =', pi, 'expected 348513')
print('bytes:', len(out))
# sanity vs public cases
import json
cases = json.load(open('cases.json'))
for c in cases:
    got = struct.unpack_from('<I', out, 4*c['n'])[0]
    assert got == c['count'], (c, got)
print('public cases OK')
