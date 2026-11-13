import subprocess, time, statistics, os
def bench(cmd, n, reps=15):
    ts=[]
    for _ in range(reps):
        t=time.perf_counter()
        p=subprocess.run(cmd, input=f"{n}\n", capture_output=True, text=True, shell=True)
        ts.append(time.perf_counter()-t)
    return statistics.median(ts), min(ts), p.stdout.strip()
for n in (1000000, 5000000):
    for label, cmd in [("table ./primes","./primes"), ("table static","./primes-static"), ("table run.sh","./run.sh")]:
        med,mn,out=bench(cmd,n)
        print(f"N={n} {label:16s} median={med*1000:7.2f}ms min={mn*1000:7.2f}ms out={out}")
    # sieve fallback: run primes from a dir without the table
    med,mn,out=bench("sh -c 'cd /tmp/nop && ./primes'",n)
    print(f"N={n} {'sieve fallback':16s} median={med*1000:7.2f}ms min={mn*1000:7.2f}ms out={out}")
    # python sieve baseline
    py = ("python3 -c \"import sys; n=int(sys.stdin.read()); "
          "s=bytearray(b'\\x01')*(n+1); s[0:2]=b'\\x00\\x00'; "
          "import math; [s.__setitem__(slice(i*i,n+1,i), b'\\x00'*(((n-i*i)//i)+1)) for i in range(2,int(math.isqrt(n))+1) if s[i]]; "
          "print(sum(s))\"")
    med,mn,out=bench(py,n,reps=5)
    print(f"N={n} {'python sieve':16s} median={med*1000:7.2f}ms min={mn*1000:7.2f}ms out={out}")
