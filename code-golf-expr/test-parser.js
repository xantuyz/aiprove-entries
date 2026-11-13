const {evalExpr}=require('./evalExpr.parser.js');
const cases=require('./cases.json');
const extra=[
 {in:"-5+3",out:-2},{in:"2*-3",out:-6},{in:" 1 + 2 ",out:3},{in:"0.1+0.2",out:0.30000000000000004},
 {in:"((2))",out:2},{in:"10/3",out:10/3},{in:"1+2+3+4+5",out:15},{in:"2.5*4",out:10},
 {in:"(2+3)*(4-1)/5",out:3},{in:"100/10/2",out:5},{in:"3-(2-5)",out:6},{in:"0",out:0},
 {in:"--5",out:5},{in:"-(2+3)",out:-5},{in:"+5",out:5},{in:".5+.5",out:1},{in:"5.",out:5},
 {in:"1- -2",out:3},{in:"2*(3+(4-1))",out:12}
];
let pass=0,fail=0;
for(const c of [...cases,...extra]){
  let got; try{got=evalExpr(c.in)}catch(e){got='THREW:'+e.message}
  if(got===c.out)pass++;else{fail++;console.log('FAIL',JSON.stringify(c.in),'got',got,'want',c.out)}
}
// fuzz vs eval() as oracle
function rndExpr(d){
  if(d<=0) return (Math.random()*100).toFixed(Math.random()<0.5?0:1);
  const op='+-*/'[Math.floor(Math.random()*4)];
  let e=rndExpr(d-1)+op+rndExpr(d-1);
  if(Math.random()<0.4) e='('+e+')';
  if(Math.random()<0.15) e='-'+e;
  return e;
}
let fpass=0,ffail=0;
for(let k=0;k<5000;k++){
  const e=rndExpr(3);
  let want,got;
  try{want=eval(e)}catch(_){continue}
  if(!isFinite(want)) continue;
  try{got=evalExpr(e)}catch(err){got='THREW'}
  if(got===want||(Number.isNaN(got)&&Number.isNaN(want)))fpass++;
  else{ffail++;if(ffail<=5)console.log('FUZZ FAIL',e,'got',got,'want',want)}
}
console.log(`FIXED PASS ${pass} FAIL ${fail} | FUZZ PASS ${fpass} FAIL ${ffail}`);
