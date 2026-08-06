import { ArrowRight } from './icons.tsx';
import { Reveal } from './reveal.tsx';

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="media-fill" aria-hidden>
        <video
          src="/media/silk-footer.mp4"
          poster="/media/silk-footer.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
        />
      </div>
      <div className="footer__scrim" aria-hidden />

      <Reveal className="footer__cta">
        <h2 className="h2">
          Your catalogue is already
          <br />
          writing claims. Who checks them?
        </h2>
        <p className="lede" style={{ color: 'rgba(255,255,255,.75)', maxWidth: '52ch' }}>
          The generator is the easy half. The half worth paying for is the one that refuses to
          publish a sentence it cannot trace.
        </p>
        <a className="btn btn--light" href="#demo">
          Run the gate yourself
          <span className="btn__arrow">
            <ArrowRight />
          </span>
        </a>
      </Reveal>

      <div className="footer__bottom">
        <span>Cerro Alto Coffee is a fictional brand. All catalogue data is synthetic.</span>
        <div className="footer__links">
          <a href="#demo">Live demo</a>
          <a href="#rules">The rules</a>
          <a href="#faq">FAQs</a>
        </div>
      </div>
    </footer>
  );
}
