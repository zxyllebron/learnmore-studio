import test from 'node:test';
import assert from 'node:assert/strict';
import {course,gradeAnswer} from '../dist/content.mjs';
import {createServer,extractConversation} from '../server.mjs';

test('all nine numerical answers agree with independently calculated results',()=>{
  const mse=(pred,y)=>pred.reduce((s,p,i)=>s+(p-y[i])**2,0)/y.length;
  const expected={e1:2*3+1,e2:mse([2,4],[3,5]),e3:200*.15,m1:0-.1*((-2*1-4*2)/2),m2:mse([1,3],[2,5])/2,m3:2+.2/2*3**2,h1:mse([.5*1+.3,.5*2+.3],[2,4])/2,h2:3-.1*(-1+.2*3),h3:2/((1+4)/2)};
  for(const q of course.questions){assert.ok(Math.abs(q.answer-expected[q.id])<1e-10,q.id);assert.ok(gradeAnswer(q,String(expected[q.id])).correct);}
  for(const difficulty of ['easy','medium','hard'])assert.equal(course.questions.filter(q=>q.difficulty===difficulty).length,3);
});
test('grading rejects missing, nonfinite, expressions and text answers',()=>{
  const q=course.questions[0];for(const input of ['',' ','Infinity','NaN','7abc','7/1','<script>','0x7'])assert.equal(gradeAnswer(q,input).valid,false,input);
  assert.equal(gradeAnswer(q,'7e0').correct,true);assert.equal(gradeAnswer(q,'7.0005').correct,true);assert.equal(gradeAnswer(q,'7.01').correct,false);
});
test('conversation extraction excludes private instructions, tool outputs and commentary',()=>{
  const records=[{type:'event_msg',payload:{type:'user_message',message:'# AGENTS.md instructions\nprivate'}},{type:'response_item',payload:{type:'message',role:'developer',content:[{type:'input_text',text:'secret'}]}},{type:'event_msg',payload:{type:'user_message',message:'请解释机器学习'}},{type:'response_item',payload:{type:'message',role:'assistant',phase:'commentary',content:[{type:'output_text',text:'intermediate'}]}},{type:'response_item',payload:{type:'message',role:'assistant',phase:'final_answer',content:[{type:'output_text',text:'从数据学习规律'}]}}];
  const result=extractConversation(records.map(r=>JSON.stringify(r)).join('\n'));assert.equal(result,'用户：请解释机器学习\n\n助手：从数据学习规律');
});
test('local server serves UI and rejects cross-origin or missing-client API requests',async()=>{
  const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  try{const home=await fetch(origin);assert.equal(home.status,200);assert.match(await home.text(),/知序 Learnmore/);
    assert.equal((await fetch(origin+'/api/status')).status,403);
    assert.equal((await fetch(origin+'/api/status',{headers:{'X-Learnmore-Client':'1',Origin:'https://example.com'}})).status,403);
    assert.equal((await fetch(origin+'/api/missing',{headers:{'X-Learnmore-Client':'1'}})).status,404);
    assert.equal((await fetch(origin+'/.git/config')).status,404);
  }finally{await new Promise(r=>server.close(r));}
});
