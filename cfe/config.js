window.PORTAL_CONFIG={
  turma:'1º TANE - Extensão Ibiúna',
  componente:'CFE',
  apiUrl:'https://script.google.com/macros/s/AKfycbya3i18vWjiUcrfw7jIFzkwTDGPFEqCzMRWW2mbmQgipUoe06x-4-6IaGwCvRwU3ammKA/exec'
};
document.addEventListener('DOMContentLoaded',()=>{if(location.pathname.includes('/atividade/')){document.title='Atividade - CFE';const a=document.querySelector('header a');if(a)a.textContent='← Atividades de CFE';}});
