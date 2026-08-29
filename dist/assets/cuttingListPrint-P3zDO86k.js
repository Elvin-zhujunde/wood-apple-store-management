import{h as I,i as R,j as z,E as D,o as u,c as d,d as o,t as r,a as h,w as m,k as E,F as q,l as F,g as _,m as U,r as k,n as A,b as G,f as p}from"./index-CLHuY6dH.js";import{c as J}from"./index-BZGlCF7B.js";const O={class:"print-root"},Y={class:"print-toolbar no-print"},K={class:"ttl"},Q={class:"toolbar-right"},W={key:0,class:"state-tip no-print"},X={key:1,class:"state-tip no-print"},Z={key:2,class:"cut-sheet ledger"},w={class:"sheet-title"},tt={class:"cut-table"},et=["innerHTML"],nt={class:"sheet-foot"},lt=`
  <tr>
    <th>客户名称</th>
    <th>订单号</th>
    <th>门洞(mm)<br>高*宽*墙厚</th>
    <th>款式</th>
    <th>颜色</th>
    <th>套板线条</th>
    <th>订单备注</th>
    <th>加工备注</th>
    <th>原始尺寸(mm)<br>高*宽</th>
    <th>板材</th>
  </tr>`,b="print-page-orient",rt={__name:"cuttingListPrint",setup(st){const $=U(),C=G(),f=_("single"),l=_([]),v=_(!0);function S(t){if(!t)return[];try{const e=JSON.parse(t);return Array.isArray(e)?e.filter(a=>typeof a=="string"&&a):[]}catch{return[]}}function c(t){return t!=null&&t!==""?Math.round(Number(t)):null}function V(t){const e=S(t.remark_tags),a=e.length?e.map(n=>'<span class="tag-item">【'+n+"】</span>").join(" "):"",y=t.remark||"",s=n=>`<td>${n!=null&&n!==""?n:"-"}</td>`,i=t.wall_thick!=null?t.wall_thick:t.wall_thickness!=null?t.wall_thickness:null,x=[c(t.hole_height),c(t.hole_width),c(i)],P=x.some(n=>n!==null)?x.map(n=>n===null?"-":n).join("*"):"-",B=[c(t.door_height),c(t.door_width)],j=B.some(n=>n!==null)?B.map(n=>n===null?"-":n).join("*"):"-";return`
    ${s(t.customer)}
    ${s(t.order_no)}
    <td>${P}</td>
    ${s(t.style)}
    ${s(t.color)}
    ${s(t.frame_line)}
    <td>${y.trim()||"-"}</td>
    <td>${a||"-"}</td>
    <td class="door"><strong>${j}</strong></td>
    ${s(t.board)}`}const H=A(()=>{const t=l.value.map(e=>e.cut_date?String(e.cut_date).slice(0,10):"").filter(Boolean).sort();return t.length===0?"-":t.length===1||t[0]===t[t.length-1]?t[0]:`${t[0]} ~ ${t[t.length-1]}`}),L=A(()=>{const t=[...new Set(l.value.map(e=>e.handler).filter(Boolean))];return t.length?t.join("、"):"-"});function M(){C.push("/orders")}function N(){window.print()}const g=_("portrait");function T(){let t=document.getElementById(b);t||(t=document.createElement("style"),t.id=b,document.head.appendChild(t)),t.textContent=`@page { size: A4 ${g.value}; margin: 0; }`}return I(g,T),R(()=>{const t=document.getElementById(b);t&&t.remove()}),z(async()=>{T(),f.value=$.query.mode==="ledger"?"ledger":"single";const t=$.query.ids;if(!t){v.value=!1,D.warning("未指定打印下料单");return}try{const e=await J.list({ids:t,page:1,pageSize:9999});l.value=e.data.list||[]}finally{v.value=!1}}),(t,e)=>{const a=k("el-radio-button"),y=k("el-radio-group"),s=k("el-button");return u(),d("div",O,[o("div",Y,[o("span",K,"下料单打印 · "+r(f.value==="single"?"单张":"批量")+" · 共 "+r(l.value.length)+" 条",1),o("div",Q,[h(y,{modelValue:g.value,"onUpdate:modelValue":e[0]||(e[0]=i=>g.value=i),size:"small"},{default:m(()=>[h(a,{value:"portrait"},{default:m(()=>[...e[1]||(e[1]=[p("A4 纵向",-1)])]),_:1}),h(a,{value:"landscape"},{default:m(()=>[...e[2]||(e[2]=[p("A4 横向",-1)])]),_:1})]),_:1},8,["modelValue"]),h(s,{onClick:M},{default:m(()=>[...e[3]||(e[3]=[p("返回",-1)])]),_:1}),h(s,{type:"primary",disabled:!l.value.length,onClick:N},{default:m(()=>[...e[4]||(e[4]=[p("打印",-1)])]),_:1},8,["disabled"])])]),v.value?(u(),d("div",W,"加载中…")):l.value.length?E("",!0):(u(),d("div",X,"未找到下料单数据（可能未选择或已删除）。")),l.value.length?(u(),d("section",Z,[o("div",w,r(f.value==="single"?"下料单":"下料单台账")+" · 共 "+r(l.value.length)+" 条",1),o("table",tt,[o("thead",{innerHTML:lt}),o("tbody",null,[(u(!0),d(q,null,F(l.value,i=>(u(),d("tr",{key:i.id,innerHTML:V(i)},null,8,et))),128))])]),o("div",nt,"共 "+r(l.value.length)+" 条　下料日区间："+r(H.value)+"　经手人："+r(L.value),1)])):E("",!0)])}}};export{rt as default};
