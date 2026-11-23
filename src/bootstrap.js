// Keep the complete HTML in place until the enhanced interface is ready.
const fallback=document.getElementById('root');
let restore;
function failed(error){
 restore?.();
 const status=fallback.querySelector('[data-enhancement-status]');
 if(status)status.textContent='Interactive controls are unavailable. The complete Atlas remains readable below.';
 console.error('Atlas enhancement failed:',error);
}
try{
 const {mountTimeline}=await import('./main.jsx');
 restore=mountTimeline(fallback,failed);
}catch(error){failed(error)}
