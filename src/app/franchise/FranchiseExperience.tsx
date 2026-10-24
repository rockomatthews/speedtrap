'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import styles from './franchise.module.css';
const Scene = dynamic(() => import('./FranchiseScene'), { ssr: false });
const stages = [
 ['Bring Speed Trap to your city.', 'Connect race simulation, competitive leagues, food, and hospitality with the technology to bring it all together.'],
 ['The tools behind the thrill.', 'Customizable bookings. Competitive leagues. Customer rewards. A connected experience built around your operation.'],
 ['Build your own starting grid.', 'Start with the venue you envision. Configure the simulator capacity, then plan for what comes next.']
];
export function FranchiseHero(){
 const section=useRef<HTMLElement>(null);const [motion,setMotion]=useState(false);const [ready,setReady]=useState(false);const [stage,setStage]=useState(0);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{setMotion(!query.matches);if(query.matches){setReady(false);setStage(0);}};update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 return <section ref={section} className={`${styles.hero} ${!motion?styles.staticHero:''}`} aria-labelledby="franchise-title">
  <div className={styles.heroSticky}>
   <div className={styles.heroTop}><p className={styles.eyebrow}>Speed Trap Racing / Franchise opportunities</p><h1 id="franchise-title">Put your business on the <span className={styles.srOnly}>leading edge.</span></h1></div>
   <div className={`${styles.fallback} ${ready?styles.hidden:''}`} aria-hidden="true">LEADING<br/>EDGE<span className={styles.titleRule}/></div>
   {motion&&<Scene section={section} onReady={setReady} onStage={setStage}/>}
   <div className={styles.heroBottom}><div className={styles.heroCopy}><span className={styles.stageLabel}>{['Leading edge','Built to run','Ready to grow'][stage]}</span><h2>{stages[stage][0]}</h2><p>{stages[stage][1]}</p></div><div className={styles.heroActions}><a className={styles.button} href="mailto:andrew@speedtrapracing.com?subject=Speed%20Trap%20Franchise%20Inquiry">Explore franchise opportunities <span aria-hidden="true">↗</span></a><a className={styles.secondaryLink} href="#franchise-platform">See what powers Speed Trap <span aria-hidden="true">↓</span></a></div></div>
   <div className={styles.progress} aria-hidden="true">{stages.map((_,i)=><span key={i} className={i===stage?styles.active:''}/>)}</div>
  </div>
 </section>;
}
export function CopyEmail(){const [message,setMessage]=useState('');return <div className={styles.copyWrap}><button className={styles.copy} onClick={async()=>{try{await navigator.clipboard.writeText('andrew@speedtrapracing.com');setMessage('Email copied');}catch{setMessage('Please select and copy the email address above.');}}}>Copy email</button><span role="status">{message}</span></div>;}
