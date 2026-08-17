import{h as V,E as j,o as i,c as d,d as s,t as a,a as k,w as $,i as b,F as p,j as H,g as c,k as A,r as D,l as f,b as E,f as T,m as P}from"./index-DXAbogXZ.js";import{c as C}from"./index-Cxjswk1a.js";import{f as q}from"./date-BKRYYSDJ.js";const F={class:"print-root"},W={class:"print-toolbar no-print"},z={class:"ttl"},J={key:0,class:"state-tip no-print"},O={key:1,class:"state-tip no-print"},G={class:"sheet-title"},I={class:"cut-table"},K=["innerHTML"],Q=["innerHTML"],U={class:"sheet-foot"},X={key:1,class:"cut-sheet ledger"},Y={class:"sheet-title"},Z={class:"cut-table"},w=["innerHTML"],tt=["innerHTML"],et={class:"sheet-foot"},ot={__name:"cuttingListPrint",setup(st){const m=A(),L=E(),h=c("single"),l=c([]),_=c({defaultHeightCut:40,defaultWidthCut:70}),g=c(!0);function M(t){if(!t)return[];try{const e=JSON.parse(t);return Array.isArray(e)?e.filter(o=>typeof o=="string"&&o):[]}catch{return[]}}const v=f(()=>{const t=_.value.defaultHeightCut,e=_.value.defaultWidthCut;return`
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
      <th>板材</th><th>高-${t}</th><th>宽-${e}</th>
    </tr>`});function y(t){const e=M(t.remark_tags),o=e.length?" "+e.map(u=>"【"+u+"】").join(""):"",n=(t.remark||"")+o,r=u=>`<td>${u!=null&&u!==""?u:"-"}</td>`,S=t.wall_thick!=null?t.wall_thick:t.wall_thickness!=null?t.wall_thickness:"-";return`
    ${r(t.customer)}
    ${r(t.order_no)}
    ${r(t.hole_height)}
    ${r(t.hole_width)}
    ${r(S)}
    ${r(t.style)}
    ${r(t.color)}
    ${r(t.frame_line)}
    <td>${n.trim()||"-"}</td>
    ${r(t.board)}
    <td class="door"><strong>${t.door_height!=null?t.door_height:"-"}</strong></td>
    <td class="door"><strong>${t.door_width!=null?t.door_width:"-"}</strong></td>`}const B=f(()=>{const t=l.value.map(e=>e.cut_date?String(e.cut_date).slice(0,10):"").filter(Boolean).sort();return t.length===0?"-":t.length===1||t[0]===t[t.length-1]?t[0]:`${t[0]} ~ ${t[t.length-1]}`}),x=f(()=>{const t=[...new Set(l.value.map(e=>e.handler).filter(Boolean))];return t.length?t.join("、"):"-"});function N(){L.push("/orders")}function R(){window.print()}return V(async()=>{h.value=m.query.mode==="ledger"?"ledger":"single";const t=m.query.ids;if(!t){g.value=!1,j.warning("未指定打印下料单");return}try{const[e,o]=await Promise.all([C.list({ids:t,page:1,pageSize:9999}),C.getConfig()]);l.value=e.data.list||[],_.value=o.data}finally{g.value=!1}}),(t,e)=>{const o=D("el-button");return i(),d("div",F,[s("div",W,[s("span",z,"下料单打印 · "+a(h.value==="single"?"单张":"批量")+" · 共 "+a(l.value.length)+" 条",1),s("div",null,[k(o,{onClick:N},{default:$(()=>[...e[0]||(e[0]=[T("返回",-1)])]),_:1}),k(o,{type:"primary",disabled:!l.value.length,onClick:R},{default:$(()=>[...e[1]||(e[1]=[T("打印",-1)])]),_:1},8,["disabled"])])]),g.value?(i(),d("div",J,"加载中…")):l.value.length?b("",!0):(i(),d("div",O,"未找到下料单数据（可能未选择或已删除）。")),l.value.length?(i(),d(p,{key:2},[h.value==="single"?(i(!0),d(p,{key:0},H(l.value,n=>(i(),d("section",{key:n.id,class:"cut-sheet single"},[s("div",G,"下料单 · 订单号 "+a(n.order_no)+" · "+a(n.customer),1),s("table",I,[s("thead",{innerHTML:v.value},null,8,K),s("tbody",null,[s("tr",{innerHTML:y(n)},null,8,Q)])]),s("div",U,"下料日："+a(P(q)(n.cut_date))+"　经手人："+a(n.handler||"-")+"　模式："+a(n.mode===2?"特殊（手填）":"普通（自动扣尺）"),1)]))),128)):(i(),d("section",X,[s("div",Y,"下料单台账 · 共 "+a(l.value.length)+" 条",1),s("table",Z,[s("thead",{innerHTML:v.value},null,8,w),s("tbody",null,[(i(!0),d(p,null,H(l.value,n=>(i(),d("tr",{key:n.id,innerHTML:y(n)},null,8,tt))),128))])]),s("div",et,"共 "+a(l.value.length)+" 条　下料日区间："+a(B.value)+"　经手人："+a(x.value),1)]))],64)):b("",!0)])}}};export{ot as default};
