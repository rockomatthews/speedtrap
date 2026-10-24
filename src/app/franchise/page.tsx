import type { Metadata } from 'next';
import Image from 'next/image';
import { NavBar } from '@/components/NavBar';
import { FranchiseHero, CopyEmail } from './FranchiseExperience';
import styles from './franchise.module.css';

export const metadata: Metadata = {
 title: 'Franchise opportunities',
 description: 'Bring Speed Trap Racing to your city. Explore a race simulation, restaurant and bar concept powered by customizable bookings, leagues, driver stats and rewards.',
 alternates: { canonical: '/franchise' },
 openGraph: { title: 'Your city. The next Speed Trap.', description: 'Explore Speed Trap Racing franchise opportunities. Racing, hospitality and the technology to bring it all together.', url: '/franchise', images: [{ url: '/home/speedtrap-active-sims.jpg', alt: 'Racing simulators at Speed Trap Racing' }] },
 twitter: { card: 'summary_large_image', title: 'Your city. The next Speed Trap.', description: 'Explore Speed Trap Racing franchise opportunities.', images: ['/home/speedtrap-active-sims.jpg'] }
};
const email = 'mailto:andrew@speedtrapracing.com?subject=Speed%20Trap%20Franchise%20Inquiry';
const benefits = [
 ['Bookings', 'Your operation. Your rules.', 'Shape session options, scheduling, pricing, and promotions around your operation.'],
 ['Leagues', 'Give competition a home.', 'Organize seasons, registrations, dues, standings, and competitive events with league creation and tracking.'],
 ['Driver stats', 'Every session has a story.', 'Give racers a reason to return with supported VMS lap history, results, and leaderboards.'],
 ['Memberships & rewards', 'Turn first visits into traditions.', 'Support recurring relationships with member benefits, prepaid racing credits, and automatic rewards.'],
 ['Restaurant & bar', 'Make a race into a night out.', 'Build on Speed Trap’s existing full-menu concept and social atmosphere. Food, friends, and racing under one roof.'],
 ['Venue operations', 'Keep the experience connected.', 'Bring website reservations, simulator capacity, and supported VMS workflows together.']
];
export default function FranchisePage() {
 return <div className={styles.page}>
  <NavBar />
  <main>
   <FranchiseHero />
   <section className={styles.capabilities} id="franchise-platform" aria-labelledby="platform-title">
    <div className={styles.sectionHead}><p className={styles.eyebrow}>Powered by Speed Trap</p><h2 id="platform-title">The technology.<br/><span>The experience.</span></h2><p>A place to race is just the start. Bring the tools, competition, and hospitality together to build a destination people return to.</p></div>
    <div className={styles.benefits}>{benefits.map(([label,title,body],i)=><article key={label}><div className={styles.featureTop}><span className={styles.featureMark} aria-hidden="true">{['⌁','⚑','↗','＋','◉','⌘'][i]}</span><p>{label}</p></div><h3>{title}</h3><p>{body}</p></article>)}</div>
    <p className={styles.note}>These capabilities are available to discuss and configure for your venue. The right setup starts with your business.</p>
   </section>
   <section className={styles.venueStrip} aria-label="The Speed Trap experience">
    <figure><Image src="/home/speedtrap-active-sims.jpg" alt="Drivers racing in Speed Trap’s simulator bays" fill sizes="(max-width: 700px) 100vw, 60vw"/><figcaption>Race together.</figcaption></figure>
    <figure><Image src="/home/speedtrap-restaurant-bar.jpg" alt="The restaurant and bar at Speed Trap Racing" fill sizes="(max-width: 700px) 100vw, 40vw"/><figcaption>Stay for the night.</figcaption></figure>
   </section>
   <section className={styles.scale} aria-labelledby="scale-title">
    <div><p className={styles.eyebrow}>Room to grow</p><h2 id="scale-title">Your footprint.<br/><span>Your starting grid.</span></h2><p>Plan the number of simulators that fits your space, then expand as your business grows. Speed Trap’s website and VMS integration can be configured around your venue’s simulator capacity.</p><p className={styles.note}>Capacity and expansion depend on venue configuration, hardware, and VMS licensing.</p></div>
    <div className={styles.bayDiagram} aria-hidden="true"><div className={styles.bayGrid}>{Array.from({length:6},(_,i)=><div className={`${styles.bay} ${i>3?styles.expansion:''}`} key={i}><i/><b/><span>{i>3?'+':'STR'}</span></div>)}</div><p>START WITH YOUR SPACE. BUILD YOUR GRID.</p></div>
   </section>
   <section className={styles.network} aria-labelledby="network-title">
    <div className={styles.networkArt} aria-hidden="true"><span className={styles.networkLine}/><i/><i/><i/><span className={styles.networkWord}>STR<span>×</span>STR</span></div>
    <div><p className={styles.eyebrow}>Future network opportunities</p><h2 id="network-title">Different cities.<br/><span>One starting grid.</span></h2><p>Imagine your local champions competing against racers at other Speed Trap locations—with shared seasons, coordinated events, and a wider racing community.</p><p className={styles.note}>A vision for a connected franchise network, as the network develops.</p></div>
   </section>
   <section className={styles.future} aria-labelledby="future-title"><p className={styles.eyebrow}>Looking ahead</p><h2 id="future-title">Always looking toward<br/>the next turn.</h2><p>Our ambition extends beyond four wheels. As interest in MotoGP and motorcycle simulation grows, Speed Trap aims to be an early adopter of emerging experiences that meet our standards for immersion, reliability, and venue integration.</p></section>
   <section className={styles.contact} aria-labelledby="contact-title"><p className={styles.eyebrow}>Let’s start a conversation</p><h2 id="contact-title">Your city.<br/>Your community.<br/><span>The next Speed Trap.</span></h2><p>Interested in franchising opportunities? Talk with Andrew about your vision.</p><a className={styles.button} href={email}>Explore franchise opportunities <span aria-hidden="true">↗</span></a><div className={styles.contactDetails}><a href={email}>andrew@speedtrapracing.com</a><CopyEmail /></div></section>
  </main>
  <footer className={styles.footer}><a href="/" aria-label="Speed Trap Racing home"><img src="/brand/logo.svg" alt="Speed Trap Racing" width="190" height="50"/></a><p>Race simulation. Real community.</p><a href="/pricing">Explore the Speed Trap experience</a></footer>
 </div>;
}
