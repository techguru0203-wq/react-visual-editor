export function TutorialVideo() {
  return (
    <iframe
      title="Omniflow Demo"
      style={{ width: '100%', height: 'calc(100vh - 240px)', border: 'none' }}
      id="player"
      src="https://www.youtube.com/embed/kIy7FWbONUs"
      allowFullScreen={true}
      allow="accelerometer; gyroscope; autoplay; fullscreen; encrypted-media; picture-in-picture;"
    ></iframe>
  );
}
