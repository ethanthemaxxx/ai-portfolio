import Widget from './widget.tsx';

/**
 * The demo page.
 *
 * It says out loud which mode it's in. A demo that quietly replays fixtures while
 * implying live inference is the kind of thing that costs you a client in the
 * second meeting.
 */
export default function Page() {
  const live = Boolean(process.env['ANTHROPIC_API_KEY']);

  return (
    <main className="page">
      <div className="page__intro">
        <h1>Cerro Alto Coffee — support agent</h1>
        <p>
          Answers come from the store&apos;s own help centre and a live order lookup. When the
          documents don&apos;t support an answer, or when money would have to be committed, it
          hands off to a person instead of guessing.
        </p>
        <p>
          Try: an order that stalled in transit (<code>CA-10244</code>), a refund over the
          approval limit (<code>CA-10250</code>), or which grind to buy for an Aeropress.
        </p>
        <span className="page__mode">
          {live
            ? 'Live — real inference against claude-opus-5'
            : 'Fixture mode — scripted turns, no API key set'}
        </span>
      </div>

      <Widget />
    </main>
  );
}
