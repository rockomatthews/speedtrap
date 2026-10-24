'use client';
import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import styles from './franchise.module.css';

type Props={section:RefObject<HTMLElement|null>;onReady:(ready:boolean)=>void;onStage:(stage:number)=>void};
export default function FranchiseScene({section,onReady,onStage}:Props){
 const mount=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const host=mount.current;const root=section.current;if(!host||!root)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{onReady(false);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(35,1,.1,100);camera.position.set(0,0,22);
  scene.add(new THREE.AmbientLight(0xffffff,2.2));
  const key=new THREE.DirectionalLight(0xffffff,5);key.position.set(-3,6,8);scene.add(key);
  const red=new THREE.DirectionalLight(0xff161f,5);red.position.set(8,-1,4);scene.add(red);
  const rim=new THREE.DirectionalLight(0xffd200,3);rim.position.set(-8,1,1);scene.add(rim);
  const titles:THREE.Group[]=[];const dimensions:THREE.Vector3[]=[];const bays=new THREE.Group();scene.add(bays);
  const mobile=window.matchMedia('(max-width:700px)').matches;
  const bayMaterial=new THREE.MeshStandardMaterial({color:0x35353b,metalness:.6,roughness:.4});
  const screenMaterial=new THREE.MeshStandardMaterial({color:0xffd200,emissive:0xffd200,emissiveIntensity:.3});
  for(let i=0;i<(mobile?4:6);i++){
   const bay=new THREE.Group();
   const base=new THREE.Mesh(new THREE.BoxGeometry(1.1,.13,1.5),bayMaterial);bay.add(base);
   const screen=new THREE.Mesh(new THREE.BoxGeometry(1,.6,.08),screenMaterial);screen.position.set(0,.7,-.5);bay.add(screen);
   const seat=new THREE.Mesh(new THREE.BoxGeometry(.45,.55,.5),bayMaterial);seat.position.set(0,.35,.25);bay.add(seat);
   bay.position.set((i-((mobile?4:6)-1)/2)*1.4,-.2,0);bays.add(bay);
  }
  bays.position.y=-.8;bays.rotation.x=.4;bays.visible=false;
  let raf=0,disposed=false,failed=false,visible=true,loaded=false,lastStage=-1;
  const abort=new AbortController();
  const fail=()=>{failed=true;onReady(false);onStage(0);};
  function draw(){
   raf=0;if(disposed||failed||!visible||!loaded||document.hidden)return;
   const rect=root!.getBoundingClientRect();const height=host!.clientHeight;const width=host!.clientWidth;
   const stickyTop=width>1100?72:64;
   const progress=THREE.MathUtils.clamp((stickyTop-rect.top)/Math.max(1,rect.height-height),0,1);
   const stage=progress<.34?0:progress<.7?1:2;
   if(stage!==lastStage){onStage(stage);lastStage=stage;}
   const viewHeight=2*Math.tan(THREE.MathUtils.degToRad(17.5))*22;
   titles.forEach((title,i)=>{
    title.visible=i===stage;if(!title.visible)return;
    const fit=Math.min(viewHeight*camera.aspect*.83/dimensions[i].x,viewHeight*(mobile?.25:.32)/dimensions[i].y);
    title.scale.setScalar(fit);title.position.y=mobile?1.6:1.1;
    title.rotation.set(.06,-.15+progress*.22,-.045+progress*.045);
    title.position.x=(1-progress)*-.2;
   });
   bays.visible=stage===2;bays.scale.setScalar(Math.min(1,viewHeight*camera.aspect*.78/9));bays.rotation.y=(progress-.7)*.6;
   try{renderer.render(scene,camera);onReady(true);}catch{fail();}
  }
  function schedule(){if(!raf&&!disposed&&!failed&&visible&&!document.hidden)raf=requestAnimationFrame(draw);}
  function resize(){const width=host!.clientWidth,height=host!.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();schedule();}
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();else{cancelAnimationFrame(raf);raf=0;}},{threshold:0});observer.observe(host);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
  const contextLost=(event:Event)=>{event.preventDefault();fail();};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  window.addEventListener('scroll',schedule,{passive:true});document.addEventListener('visibilitychange',schedule);
  fetch('/franchise/helvetiker_bold.typeface.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('Font unavailable');return r.json();}).then(data=>{
   if(disposed)return;const font=new FontLoader().parse(data);
   [['LEADING','EDGE'],['BUILT','TO RUN.'],['READY','TO GROW.']].forEach(lines=>{
    const group=new THREE.Group();const face=new THREE.MeshStandardMaterial({color:0xdde0e7,metalness:.55,roughness:.3});const side=new THREE.MeshStandardMaterial({color:0x56565f,metalness:.7,roughness:.4});
    lines.forEach((line,i)=>{const geometry=new TextGeometry(line,{font,size:1,depth:.18,curveSegments:mobile?3:6,bevelEnabled:true,bevelThickness:.015,bevelSize:.012,bevelSegments:2});geometry.computeBoundingBox();const mesh=new THREE.Mesh(geometry,[face,side]);mesh.position.x=-geometry.boundingBox!.max.x/2;mesh.position.y=(1-i)*1.12;group.add(mesh);});
    const box=new THREE.Box3().setFromObject(group);const center=box.getCenter(new THREE.Vector3());group.children.forEach(child=>child.position.sub(center));dimensions.push(box.getSize(new THREE.Vector3()));titles.push(group);scene.add(group);
   });loaded=true;resize();
  }).catch(()=>{if(!disposed)fail();});
  resize();
  return()=>{disposed=true;abort.abort();cancelAnimationFrame(raf);observer.disconnect();resizeObserver.disconnect();window.removeEventListener('scroll',schedule);document.removeEventListener('visibilitychange',schedule);renderer.domElement.removeEventListener('webglcontextlost',contextLost);const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(obj=>{if(obj instanceof THREE.Mesh){geometries.add(obj.geometry);const list=Array.isArray(obj.material)?obj.material:[obj.material];list.forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
 },[section,onReady,onStage]);
 return <div ref={mount} className={styles.scene} aria-hidden="true"/>;
}
