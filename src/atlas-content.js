// The readable HTML is already on screen; this request only enables the controls.
export async function loadAtlas(){
 const url=document.documentElement.dataset.atlasContent;
 if(!url)throw Error('The Atlas content address is missing.');
 const response=await fetch(url);
 if(!response.ok)throw Error('Atlas content could not load. Please refresh to try again.');
 const content=await response.json();
 if(content?.schema!==1||!content.timeline?.roots)throw Error('The Atlas content format is unsupported.');
 if(content.revision!==document.documentElement.dataset.atlasRevision)throw Error('The Atlas versions do not match. Please refresh.');
 document.documentElement.dataset.atlasRevision=content.revision;
 return content.timeline;
}
