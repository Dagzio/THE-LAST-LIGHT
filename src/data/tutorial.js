// Tutorial (D11, D43): event-driven hint cards during the first runs of the first map — no narrator character
// (user decision), every hint pauses the world until GOT IT, skippable with a confirmation, seen hints are stored
// in the profile (a retry never repeats them), replay only through RESET PROGRESS.
// target: CSS selector of the highlighted element (desktop / touch); text: i18n key (touch variant if given).

export const TUTORIAL = {
  mapId: 'ashen_coast',       // the tutorial lives in the first map only
  steps: {
    beacon: { icon: 'beacon', text: 'tut.beacon', target: { desk: '#hudBeacon', touch: '#hudBeacon' }, then: 'move' },
    move: { icon: 'move', text: 'tut.move', touchText: 'tut.move.touch', target: { desk: null, touch: '#touchStick' }, then: 'prep' },
    prep: { icon: 'wave', text: 'tut.prep', target: { desk: '.next-wave-bottom.on', touch: '.next-wave-top.on' } },
    shoot: { icon: 'aim', text: 'tut.shoot', touchText: 'tut.shoot.touch', target: { desk: null, touch: null } },
    light: { icon: 'beam', text: 'tut.light', target: { desk: null, touch: null } },
    dash: { icon: 'dash', text: 'tut.dash', touchText: 'tut.dash.touch', target: { desk: null, touch: '[data-touch-action="dash"]' } },
    shop: { icon: 'shop', text: 'tut.shop', touchText: 'tut.shop.touch', target: { desk: '#hudShop', touch: '#hudShop' } },
    shopTabs: { icon: 'shop', text: 'tut.shopTabs', target: { desk: '#popup-shop .tabs', touch: '#popup-shop .tabs' } },
    grenade: { icon: 'grenade', text: 'tut.grenade', touchText: 'tut.grenade.touch', target: { desk: '#hudGrenade', touch: '#grenadeBtn' } },
    device: { icon: 'device', text: 'tut.device', target: { desk: null, touch: null } },
    crate: { icon: 'crate', text: 'tut.crate', target: { desk: null, touch: null } },
    flare: { icon: 'flare', text: 'tut.flare', touchText: 'tut.flare.touch', target: { desk: '.flare-hud', touch: '.flare-neon' } },
    boss: { icon: 'boss', text: 'tut.boss', target: { desk: '#hudBoss', touch: '#hudBoss' } },
  },
};

export const TUTORIAL_STEP_IDS = Object.keys(TUTORIAL.steps);
