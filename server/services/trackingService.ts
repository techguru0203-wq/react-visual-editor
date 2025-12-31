import mixpanel from 'mixpanel';

const MixPanel = mixpanel.init(process.env.REACT_APP_MIXPANEL_TOKEN as string);

export default MixPanel;
