// Load this site's own content. The original reading Atlas is independent.
export async function loadAtlas(){
 const response=await fetch('./atlas-content.json?refresh='+Date.now(),{cache:'no-store'});
 if(!response.ok)throw Error('Atlas content could not load. Please refresh to try again.');
 const content=await response.json();
 if(content?.schema!==1||!content.timeline?.roots)throw Error('The Atlas content format is unsupported.');
 const style=document.createElement('style');style.id='atlas-content-styles';style.textContent=content.css;
 document.head.insertBefore(style,document.querySelector('link[href="./styles.css"]'));
 document.documentElement.dataset.atlasRevision=content.revision;
 return content.timeline;
}
