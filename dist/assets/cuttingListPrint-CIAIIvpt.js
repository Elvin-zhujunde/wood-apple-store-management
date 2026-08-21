import{h as S,E as R,o as r,c as i,d as s,t as a,a as f,w as v,i as y,F as _,j as k,g,k as V,r as j,l as $,b as A,f as b,m as D}from"./index-CluXucob.js";import{c as E}from"./index-hqz9FOdE.js";import{f as q}from"./date-BKRYYSDJ.js";const F={class:"print-root"},P={class:"print-toolbar no-print"},z={class:"ttl"},J={key:0,class:"state-tip no-print"},O={key:1,class:"state-tip no-print"},G={class:"sheet-title"},I={class:"cut-table"},K=["innerHTML"],Q={class:"sheet-foot"},U={key:1,class:"cut-sheet ledger"},W={class:"sheet-title"},X={class:"cut-table"},Y=["innerHTML"],Z={class:"sheet-foot"},H=`
  <tr>
    <th rowspan="2">客户名称</th>
    <th rowspan="2">订单号</th>
    <th colspan="3">门洞</th>
    <th rowspan="2">款式</th>
    <th rowspan="2">颜色</th>
    <th rowspan="2">套板线条</th>
    <th rowspan="2">备注</th>
    <th colspan="3">门扇</th>
  </tr>
  <tr>
    <th>高</th><th>宽</th><th>墙厚</th>
    <th>板材</th><th>高</th><th>宽</th>
  </tr>`,nt={__name:"cuttingListPrint",setup(w){const p=V(),T=A(),h=g("single"),l=g([]),u=g(!0);function L(t){if(!t)return[];try{const e=JSON.parse(t);return Array.isArray(e)?e.filter(c=>typeof c=="string"&&c):[]}catch{return[]}}function m(t){const e=L(t.remark_tags),c=e.length?" "+e.map(d=>"【"+d+"】").join(""):"",n=(t.remark||"")+c,o=d=>`<td>${d!=null&&d!==""?d:"-"}</td>`,N=t.wall_thick!=null?t.wall_thick:t.wall_thickness!=null?t.wall_thickness:"-";return`
    ${o(t.customer)}
    ${o(t.order_no)}
    ${o(t.hole_height)}
    ${o(t.hole_width)}
    ${o(N)}
    ${o(t.style)}
    ${o(t.color)}
    ${o(t.frame_line)}
    <td>${n.trim()||"-"}</td>
    ${o(t.board)}
    <td class="door"><strong>${t.door_height!=null?t.door_height:"-"}</strong></td>
    <td class="door"><strong>${t.door_width!=null?t.door_width:"-"}</strong></td>`}const M=$(()=>{const t=l.value.map(e=>e.cut_date?String(e.cut_date).slice(0,10):"").filter(Boolean).sort();return t.length===0?"-":t.length===1||t[0]===t[t.length-1]?t[0]:`${t[0]} ~ ${t[t.length-1]}`}),B=$(()=>{const t=[...new Set(l.value.map(e=>e.handler).filter(Boolean))];return t.length?t.join("、"):"-"});function x(){T.push("/orders")}function C(){window.print()}return S(async()=>{h.value=p.query.mode==="ledger"?"ledger":"single";const t=p.query.ids;if(!t){u.value=!1,R.warning("未指定打印下料单");return}try{const e=await E.list({ids:t,page:1,pageSize:9999});l.value=e.data.list||[]}finally{u.value=!1}}),(t,e)=>{const c=j("el-button");return r(),i("div",F,[s("div",P,[s("span",z,"下料单打印 · "+a(h.value==="single"?"单张":"批量")+" · 共 "+a(l.value.length)+" 条",1),s("div",null,[f(c,{onClick:x},{default:v(()=>[...e[0]||(e[0]=[b("返回",-1)])]),_:1}),f(c,{type:"primary",disabled:!l.value.length,onClick:C},{default:v(()=>[...e[1]||(e[1]=[b("打印",-1)])]),_:1},8,["disabled"])])]),u.value?(r(),i("div",J,"加载中…")):l.value.length?y("",!0):(r(),i("div",O,"未找到下料单数据（可能未选择或已删除）。")),l.value.length?(r(),i(_,{key:2},[h.value==="single"?(r(!0),i(_,{key:0},k(l.value,n=>(r(),i("section",{key:n.id,class:"cut-sheet single"},[s("div",G,"下料单 · 订单号 "+a(n.order_no)+" · "+a(n.customer),1),s("table",I,[s("thead",{innerHTML:H}),s("tbody",null,[s("tr",{innerHTML:m(n)},null,8,K)])]),s("div",Q,"下料日："+a(D(q)(n.cut_date))+"　经手人："+a(n.handler||"-")+"　模式："+a(n.mode===2?"特殊（手填）":"普通（自动扣尺）"),1)]))),128)):(r(),i("section",U,[s("div",W,"下料单台账 · 共 "+a(l.value.length)+" 条",1),s("table",X,[s("thead",{innerHTML:H}),s("tbody",null,[(r(!0),i(_,null,k(l.value,n=>(r(),i("tr",{key:n.id,innerHTML:m(n)},null,8,Y))),128))])]),s("div",Z,"共 "+a(l.value.length)+" 条　下料日区间："+a(M.value)+"　经手人："+a(B.value),1)]))],64)):y("",!0)])}}};export{nt as default};
