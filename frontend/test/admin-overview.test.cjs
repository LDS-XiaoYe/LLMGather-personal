const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {parse,compileTemplate}=require('@vue/compiler-sfc');
const postcss=require('postcss');
const source=fs.readFileSync(path.join(__dirname,'../src/components/app/pages/AdminModule.vue'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../src/styles.css'),'utf8');
test('dashboard preserves nine metrics in five paired cards and compiles',()=>{
  const {descriptor,errors}=parse(source);assert.equal(errors.length,0);
  const compiled=compileTemplate({source:descriptor.template.content,filename:'AdminModule.vue',id:'admin-overview'});assert.equal(compiled.errors.length,0);
  const dashboard=source.split('<el-tab-pane label="概览" name="dashboard">')[1].split('</el-tab-pane>')[0];
  assert.equal((dashboard.match(/class="admin-stats-grid ui-overview-stats"/g)||[]).length,1);
  assert.equal((dashboard.match(/class="admin-stat-card"/g)||[]).length,5);
  for(const label of ['用户总数','今日新增','总收入','请求总数','活跃模型','今日收入','今日请求','总 Token 数','今日 Token'])assert(dashboard.includes(label));
});
test('five paired cards use available width and override old odd-card spanning',()=>{
  const foundation=fs.readFileSync(path.join(__dirname,'../src/ui-foundation.css'),'utf8');const root=postcss.parse(foundation);
  let grid='',cards='';root.walkRules('.admin-stats-grid.ui-overview-stats',rule=>grid+=rule.toString());root.walkRules('.ui-overview-stats .admin-stat-card',rule=>cards+=rule.toString());
  assert.match(grid,/repeat\(auto-fit/);assert.match(grid,/min\(100%, 180px\)/);assert.match(cards,/grid-column: auto !important/);
});

test('long numeric values remain visible and compact cards adapt to narrow screens',()=>{
  const root=postcss.parse(css);let numeric='';root.walkRules('.admin-stat-value',rule=>numeric+=rule.toString());
  assert.match(numeric,/overflow-wrap: anywhere/);assert.match(numeric,/font-variant-numeric: tabular-nums/);
  assert.match(css,/@container admin-dashboard \(max-width: 479px\)/);
  assert.match(css,/\.admin-stat-card:last-child:nth-child\(odd\) \{ grid-column: 1 \/ -1/);
});
