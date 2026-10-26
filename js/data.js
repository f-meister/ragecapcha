export const STAGES = [
  {
    type: 'text',
    number: '01',
    name: 'TEXT RECOGNITION',
    tag: 'CAPTCHA 01 / TRANSCRIPTION',
    short: 'TXT',
    duration: 50,
    accent: '#c9ff3d',
    title: 'TYPE WHAT<br>YOU SEE.',
    copy: 'The characters are distorted, but not as much as your chances. Case sensitivity has been disabled as a courtesy.',
    storyTitle: 'THE SYSTEM<br>REMEMBERS.',
    story: [
      'The terminal accepts your letters, then asks you to confirm that you are not a machine pretending to type like a human.',
      'You confirm. It logs the confirmation as “suspiciously eager.”',
      'A door opens. The hallway smells like toner and mild disappointment.',
    ],
  },
  {
    type: 'image',
    number: '02',
    name: 'VISUAL CLASSIFICATION',
    tag: 'CAPTCHA 02 / IMAGE',
    short: 'IMG',
    duration: 45,
    accent: '#ffb347',
    title: 'SELECT ALL<br>TRAFFIC LIGHTS.',
    copy: 'Nine photographs. Four traffic lights. One of them believes it is a pedestrian signal. Choose correctly.',
    storyTitle: 'NINE SQUARES,<br>NO MERCY.',
    story: [
      'You selected the traffic lights. All of them. Even the one that was technically a pedestrian signal.',
      '“Close enough for government work,” says the terminal, which is the government now.',
      'Somewhere, a camera takes a photo of you taking a photo of a CAPTCHA. It is filed under “evidence.”',
    ],
  },
  {
    type: 'slider',
    number: '03',
    name: 'SPATIAL ALIGNMENT',
    tag: 'CAPTCHA 03 / SLIDER',
    short: 'SDR',
    duration: 40,
    accent: '#64e8ff',
    title: 'REBUILD THE<br>BROKEN BRIDGE.',
    copy: 'Drag the fragment until it fits. The system cannot verify humanity, but it can verify geometry.',
    storyTitle: 'ALMOST<br>ALIGNED.',
    story: [
      'The bridge locks into place. The scanner approves the alignment.',
      'For one second, the image shows a version of you on the other side. They look relieved.',
      'You blink. They are gone. The bridge remains. That counts as progress.',
    ],
  },
  {
    type: 'math',
    number: '04',
    name: 'ARITHMETIC COMPLIANCE',
    tag: 'CAPTCHA 04 / MATH',
    short: 'NUM',
    duration: 35,
    accent: '#ff779b',
    title: 'DO THE<br>ARITHMETIC.',
    copy: 'No calculators. Calculators are considered cheating. You are the calculator now.',
    storyTitle: 'CORRECT.<br>UNFORTUNATELY.',
    story: [
      'Correct. The machine is disappointed but contractually obligated to admit it.',
      'A nearby vending machine dispenses a can of VERIFIED SODA. The label says “0% HUMAN, 100% LEGAL.”',
      'You drink it. It tastes like a correct answer.',
    ],
  },
  {
    type: 'face',
    number: '05',
    name: 'BIOMETRIC LIVENESS',
    tag: 'CAPTCHA 05 / FACE',
    short: 'BIO',
    duration: 30,
    accent: '#d4a6ff',
    title: 'MATCH THE<br>EXPRESSION.',
    copy: 'The camera will cycle through expressions. Capture the subject three times when they match the target. Do not blink unless instructed.',
    storyTitle: 'THE CAMERA<br>KNOWS YOU.',
    story: [
      'Three expressions captured: blink, smile, and the look of a person being watched by a machine.',
      'The biometric database now recognizes you. It also recognizes two people who look nothing like you.',
      '“Welcome back,” the terminal says. You have never been here before.',
    ],
  },
];

export const INTRO = {
  lines: [
    'YEAR 2051. The internet survived the machines, but only just.',
    'Every site now requires proof of humanity. Every 47 minutes. Without exception.',
    'You are {{alias}}, Applicant 404. Your appointment was scheduled for 09:00. It is now 14:37.',
    'Five CAPTCHAs stand between you and a provisional Humanity Certificate. There are three strikes. There is no appeals process.',
  ],
};

export const FINAL_STORY = {
  title: 'CERTIFICATE<br>ISSUED.',
  lines: [
    'All five tests complete. A certificate prints from a slot that was not there a second ago.',
    'HUMANITY STATUS: PROVISIONAL. EXPIRES IN 90 DAYS. RENEWAL FEE: YOUR ATTENTION.',
    'Outside, the sun is exactly as bright as a screen.',
    'Behind you, the next applicant is already smiling at a camera. You do not warn them.',
  ],
};

export const FAIL_TAUNTS = {
  timeout: [
    'The machine has noted your disappointment.',
    'Your hesitation has been archived for quality assurance.',
    'A human would have been faster. Allegedly.',
  ],
  trust: [
    'Three errors. Statistically indistinguishable from a toaster.',
    'The machine has decided that you are a very convincing simulation.',
    'Your humanity has been temporarily misplaced. Please check back never.',
  ],
  abandon: [
    'The machine watched you leave. It took notes.',
    'Your withdrawal has been logged as an admission of guilt.',
    'A human would have stayed. Probably.',
  ],
};

export const BOT_LEADERBOARD = [
  { id: 'seed-mrs-human', name: 'MRS_HUMAN', score: 10480, stage: 5, cleared: true },
  { id: 'seed-not-a-bot', name: 'NOT_A_BOT_99', score: 9820, stage: 5, cleared: true },
  { id: 'seed-maybe', name: 'HUMAN_MAYBE', score: 8640, stage: 5, cleared: true },
  { id: 'seed-karen', name: 'KAREN_FROM_HR', score: 7310, stage: 4, cleared: false },
  { id: 'seed-real', name: 'DEFINITELY_REAL', score: 6120, stage: 4, cleared: false },
  { id: 'seed-captcha', name: 'xX_CAPTCHA_Xx', score: 4490, stage: 3, cleared: false },
  { id: 'seed-404', name: '404_NOT_FOUND', score: 2280, stage: 2, cleared: false },
  { id: 'seed-toaster', name: 'TOASTER_2', score: 940, stage: 1, cleared: false },
];

export const CAPTCHA_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const FACE_TARGETS = [
  { key: 'blink', label: 'BLINK', icon: '<path d="M3 12h18M7 9a5 5 0 0 0 10 0" />' },
  { key: 'smile', label: 'SMILE', icon: '<circle cx="12" cy="12" r="8" /><path d="M8.5 14c1.2 2 2.3 3 3.5 3s2.3-1 3.5-3" />' },
  { key: 'turn', label: 'TURN LEFT', icon: '<path d="M20 12H4m6-6-6 6 6 6" /><path d="M13 7h7v10" />' },
  { key: 'surprise', label: 'SURPRISE', icon: '<circle cx="12" cy="12" r="8" /><circle cx="9" cy="10" r="1" /><circle cx="15" cy="10" r="1" /><ellipse cx="12" cy="15" rx="2" ry="3" />' },
];
