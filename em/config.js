window.PORTAL_CONFIG={
  turma:'1º TANE - Extensão Ibiúna',
  componente:'EM',
  apiUrl:'https://script.google.com/macros/s/AKfycbyq2SQwHzdmUszCZnRNCXBlHnUXenvkvkWbfbFnqWqfQY76C-pqFXi9OF2fn9ud0ndiOA/exec'
};
document.addEventListener('DOMContentLoaded',()=>{if(location.pathname.includes('/atividade/')){document.title='Atividade - EM';const a=document.querySelector('header a');if(a)a.textContent='← Atividades de EM';}});
