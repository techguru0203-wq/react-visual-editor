import mixpanel from 'mixpanel-browser';

mixpanel.init(process.env.REACT_APP_MIXPANEL_TOKEN as string, {
  debug: false,
  track_pageview: true,
  persistence: 'localStorage',
});

const trackEvent = (eventName: string, properties: any) => {
  mixpanel.identify(properties.distinct_id);
  if (eventName === 'login') {
    mixpanel.people.set({
      $email: properties.email,
      $name: properties.name,
    });
  }
  mixpanel.track(eventName, properties);
};

export default trackEvent;
