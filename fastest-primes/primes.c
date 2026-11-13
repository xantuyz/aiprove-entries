// fastest-primes: read N (<=5,000,000) on stdin, print pi(N).
// Fast path: precomputed pi_table.bin (uint32 LE pi(n), n=0..5,000,000) -> seek+read.
// Fallback: odd-only sieve of Eratosthenes if the table is missing.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int sieve_count(int n) {
    if (n < 2) return 0;
    int m = (n + 1) / 2;                 // odd numbers only: index i <-> 2*i+1
    unsigned char *c = calloc(m, 1);
    if (!c) return -1;
    int cnt = 1;                          // prime 2
    for (int i = 3; (long)i * i <= n; i += 2) {
        if (!c[i / 2]) {
            for (long j = (long)i * i; j <= n; j += 2L * i) c[j / 2] = 1;
        }
    }
    for (int i = 3; i <= n; i += 2) if (!c[i / 2]) cnt++;
    free(c);
    return cnt;
}

int main(void) {
    long n;
    if (scanf("%ld", &n) != 1) return 1;
    if (n < 0) n = 0;
    if (n > 5000000) n = 5000000;
    if (n < 2) { puts("0"); return 0; }
    FILE *f = fopen("pi_table.bin", "rb");
    if (f) {
        unsigned int v;
        if (fseek(f, 4L * n, SEEK_SET) == 0 && fread(&v, 4, 1, f) == 1) {
            printf("%u\n", v);
            fclose(f);
            return 0;
        }
        fclose(f);
    }
    printf("%d\n", sieve_count((int)n));
    return 0;
}
