const {evalExpr}=require('./evalExpr.js');
const cases=require('./cases.json');
const extra=[
 {in:"-5+3",out:-2},{in:"2*-3",out:-6},{in:" 1 + 2 ",out:3},{in:"0.1+0.2",out:0.30000000000000004},
 {in:"((2))",out:2},{in:"10/3",out:10/3},{in:"1+2+3+4+5",out:15},{in:"2.5*4",out:10},
 {in:"(2+3)*(4-1)/5",out:3},{in:"100/10/2",out:5},{in:"3-(2-5)",out:6},{in:"0",out:0},
 {in:"1e3",out:1000},{in:"5%2",out:1} // % not in spec; eval handles anyway
];
let pass=0,fail=0;
for(const c of [...cases,...extra]){
  let got; try{got=evalExpr(c.in)}catch(e){got='THREW:'+e.message}
  const ok=Object.is(got,c.out)||got===c.out;
  if(ok)pass++;else{fail++;console.log('FAIL',JSON.stringify(c.in),'got',got,'want',c.out)}
}
console.log(`PASS ${pass} FAIL ${fail} of ${cases.length+extra.length}`);
