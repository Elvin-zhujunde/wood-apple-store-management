import{h as D,i as P,j as R,E as j,o as r,c as i,d as s,t as a,a as c,w as h,k as L,F as y,l as B,g as p,m as z,r as k,n as E,b as I,f as g,p as q}from"./index-6ttc8xiH.js";import{c as F}from"./index-Cm7_PbmC.js";import{f as U}from"./date-BKRYYSDJ.js";const G={class:"print-root"},J={class:"print-toolbar no-print"},O={class:"ttl"},Y={class:"toolbar-right"},K={key:0,class:"state-tip no-print"},Q={key:1,class:"state-tip no-print"},W={class:"sheet-title"},X={class:"cut-table"},Z=["innerHTML"],w={class:"sheet-foot"},tt={key:1,class:"cut-sheet ledger"},et={class:"sheet-title"},nt={class:"cut-table"},st=["innerHTML"],lt={class:"sheet-foot"},M=`
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
  </tr>`,b="print-page-orient",dt={__name:"cuttingListPrint",setup(ot){const $=z(),A=I(),m=p("single"),o=p([]),f=p(!0);function C(t){if(!t)return[];try{const e=JSON.parse(t);return Array.isArray(e)?e.filter(d=>typeof d=="string"&&d):[]}catch{return[]}}function T(t){const e=C(t.remark_tags),d=e.length?" "+e.map(u=>"【"+u+"】").join(""):"",v=(t.remark||"")+d,l=u=>`<td>${u!=null&&u!==""?u:"-"}</td>`,n=t.wall_thick!=null?t.wall_thick:t.wall_thickness!=null?t.wall_thickness:"-";return`
    ${l(t.customer)}
    ${l(t.order_no)}
    ${l(t.hole_height)}
    ${l(t.hole_width)}
    ${l(n)}
    ${l(t.style)}
    ${l(t.color)}
    ${l(t.frame_line)}
    <td>${v.trim()||"-"}</td>
    ${l(t.board)}
    <td class="door"><strong>${t.door_height!=null?t.door_height:"-"}</strong></td>
    <td class="door"><strong>${t.door_width!=null?t.door_width:"-"}</strong></td>`}const S=E(()=>{const t=o.value.map(e=>e.cut_date?String(e.cut_date).slice(0,10):"").filter(Boolean).sort();return t.length===0?"-":t.length===1||t[0]===t[t.length-1]?t[0]:`${t[0]} ~ ${t[t.length-1]}`}),V=E(()=>{const t=[...new Set(o.value.map(e=>e.handler).filter(Boolean))];return t.length?t.join("、"):"-"});function x(){A.push("/orders")}function N(){window.print()}const _=p("portrait");function H(){let t=document.getElementById(b);t||(t=document.createElement("style"),t.id=b,document.head.appendChild(t)),t.textContent=`@page { size: A4 ${_.value}; margin: 10mm; }`}return D(_,H),P(()=>{const t=document.getElementById(b);t&&t.remove()}),R(async()=>{H(),m.value=$.query.mode==="ledger"?"ledger":"single";const t=$.query.ids;if(!t){f.value=!1,j.warning("未指定打印下料单");return}try{const e=await F.list({ids:t,page:1,pageSize:9999});o.value=e.data.list||[]}finally{f.value=!1}}),(t,e)=>{const d=k("el-radio-button"),v=k("el-radio-group"),l=k("el-button");return r(),i("div",G,[s("div",J,[s("span",O,"下料单打印 · "+a(m.value==="single"?"单张":"批量")+" · 共 "+a(o.value.length)+" 条",1),s("div",Y,[c(v,{modelValue:_.value,"onUpdate:modelValue":e[0]||(e[0]=n=>_.value=n),size:"small"},{default:h(()=>[c(d,{value:"portrait"},{default:h(()=>[...e[1]||(e[1]=[g("A4 纵向",-1)])]),_:1}),c(d,{value:"landscape"},{default:h(()=>[...e[2]||(e[2]=[g("A4 横向",-1)])]),_:1})]),_:1},8,["modelValue"]),c(l,{onClick:x},{default:h(()=>[...e[3]||(e[3]=[g("返回",-1)])]),_:1}),c(l,{type:"primary",disabled:!o.value.length,onClick:N},{default:h(()=>[...e[4]||(e[4]=[g("打印",-1)])]),_:1},8,["disabled"])])]),f.value?(r(),i("div",K,"加载中…")):o.value.length?L("",!0):(r(),i("div",Q,"未找到下料单数据（可能未选择或已删除）。")),o.value.length?(r(),i(y,{key:2},[m.value==="single"?(r(!0),i(y,{key:0},B(o.value,n=>(r(),i("section",{key:n.id,class:"cut-sheet single"},[s("div",W,"下料单 · 订单号 "+a(n.order_no)+" · "+a(n.customer),1),s("table",X,[s("thead",{innerHTML:M}),s("tbody",null,[s("tr",{innerHTML:T(n)},null,8,Z)])]),s("div",w,"下料日："+a(q(U)(n.cut_date))+"　经手人："+a(n.handler||"-")+"　模式："+a(n.mode===2?"特殊（手填）":"普通（自动扣尺）"),1)]))),128)):(r(),i("section",tt,[s("div",et,"下料单台账 · 共 "+a(o.value.length)+" 条",1),s("table",nt,[s("thead",{innerHTML:M}),s("tbody",null,[(r(!0),i(y,null,B(o.value,n=>(r(),i("tr",{key:n.id,innerHTML:T(n)},null,8,st))),128))])]),s("div",lt,"共 "+a(o.value.length)+" 条　下料日区间："+a(S.value)+"　经手人："+a(V.value),1)]))],64)):L("",!0)])}}};export{dt as default};
