export const API_ENUMS = {
  EventStatus: {
    DRAFT: 'DRAFT',
    PUBLISHED: 'PUBLISHED',
    ON_SALE: 'ON_SALE',
    SOLD_OUT: 'SOLD_OUT',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED'
  },
  OrderStatus: {
    PENDING: 'PENDING',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED'
  },
  UserRole: {
    ADMIN: 'ADMIN',
    PROMOTER: 'PROMOTER',
    SCANNER: 'SCANNER',
    CUSTOMER: 'CUSTOMER'
  }
};

export const CURRENT_USER = {
  id: 'u1',
  firstName: 'Sarah',
  lastName: 'Jenkins',
  email: 'sarah@tixmo.com',
  role: API_ENUMS.UserRole.ADMIN // Change this to test permissions
};

export const MOCK_USERS = [
  { id: 'u1', firstName: 'Sarah', lastName: 'Jenkins', email: 'sarah@tixmo.com', role: 'ADMIN', status: 'ACTIVE', lastActive: 'Now' },
  { id: 'u2', firstName: 'Alex', lastName: 'Rivera', email: 'alex.r@tixmo.com', role: 'PROMOTER', status: 'ACTIVE', lastActive: '2h ago' },
  { id: 'u3', firstName: 'Mike', lastName: 'Chen', email: 'mike.c@tixmo.com', role: 'SCANNER', status: 'ACTIVE', lastActive: '1d ago' },
  { id: 'u4', firstName: 'Emma', lastName: 'Watson', email: 'emma.w@tixmo.com', role: 'SCANNER', status: 'PENDING', lastActive: '-' },
  { id: 'u5', firstName: 'David', lastName: 'Kim', email: 'david.k@tixmo.com', role: 'PROMOTER', status: 'SUSPENDED', lastActive: '5d ago' },
];

export const MOCK_ANALYTICS_DATA = [
  { date: 'Mon', sales: 4000, tickets: 240 },
  { date: 'Tue', sales: 3000, tickets: 139 },
  { date: 'Wed', sales: 2000, tickets: 980 },
  { date: 'Thu', sales: 2780, tickets: 390 },
  { date: 'Fri', sales: 1890, tickets: 480 },
  { date: 'Sat', sales: 2390, tickets: 380 },
  { date: 'Sun', sales: 3490, tickets: 430 },
];

export const MOCK_EVENTS = [
  {
    id: '1',
    name: 'Summer Music Festival 2025',
    venue: 'Madison Square Garden',
    startDatetime: '2025-07-15T19:00:00Z',
    status: API_ENUMS.EventStatus.ON_SALE,
    capacity: 20000,
    sold: 14500,
    revenue: 1250000,
    category: 'Music'
  },
  {
    id: '2',
    name: 'TechConf Global',
    venue: 'Convention Center',
    startDatetime: '2025-09-10T09:00:00Z',
    status: API_ENUMS.EventStatus.PUBLISHED,
    capacity: 5000,
    sold: 1200,
    revenue: 600000,
    category: 'Conference'
  },
  {
    id: '3',
    name: 'Comedy Night Special',
    venue: 'The Laugh Factory',
    startDatetime: '2025-06-20T20:00:00Z',
    status: API_ENUMS.EventStatus.SOLD_OUT,
    capacity: 300,
    sold: 300,
    revenue: 15000,
    category: 'Comedy'
  },
  {
    id: '4',
    name: 'Indie Film Premiere',
    venue: 'Silver Screen Theater',
    startDatetime: '2025-10-05T18:30:00Z',
    status: API_ENUMS.EventStatus.DRAFT,
    capacity: 200,
    sold: 0,
    revenue: 0,
    category: 'Cinema'
  }
];

export const MOCK_VENUES = [
  { id: 'v1', name: 'Madison Square Garden', capacity: 20000, address: 'New York, NY' },
  { id: 'v2', name: 'Convention Center', capacity: 5000, address: 'San Francisco, CA' },
  { id: 'v3', name: 'The Laugh Factory', capacity: 300, address: 'Los Angeles, CA' },
  { id: 'v4', name: 'Silver Screen Theater', capacity: 200, address: 'Austin, TX' }
];

export const MOCK_RECENT_ORDERS = [
  { id: 'ord_1', customer: 'Alex Johnson', event: 'Summer Music Festival', amount: 250.00, status: API_ENUMS.OrderStatus.PAID, time: '2 mins ago' },
  { id: 'ord_2', customer: 'Sarah Smith', event: 'TechConf Global', amount: 899.00, status: API_ENUMS.OrderStatus.PAID, time: '15 mins ago' },
  { id: 'ord_3', customer: 'Mike Brown', event: 'Comedy Night', amount: 45.00, status: API_ENUMS.OrderStatus.PENDING, time: '1 hour ago' },
  { id: 'ord_4', customer: 'Emily Davis', event: 'Summer Music Festival', amount: 125.00, status: API_ENUMS.OrderStatus.CANCELLED, time: '3 hours ago' },
];

export const MOCK_TICKET_TYPES = [
  { id: 'tt1', name: 'General Admission', price: 85, sold: 12000, total: 15000, status: 'ACTIVE' },
  { id: 'tt2', name: 'VIP Experience', price: 250, sold: 2500, total: 3000, status: 'ACTIVE' },
  { id: 'tt3', name: 'Early Bird', price: 65, sold: 2000, total: 2000, status: 'SOLD_OUT' },
];

export const MOCK_GUESTS = [
  { id: 'g1', name: 'Alice Freeman', type: 'VIP Experience', status: 'Checked In', time: '10:42 AM' },
  { id: 'g2', name: 'Bob Smith', type: 'General Admission', status: 'Checked In', time: '11:15 AM' },
  { id: 'g3', name: 'Charlie Day', type: 'General Admission', status: 'Pending', time: '-' },
  { id: 'g4', name: 'Dana White', type: 'VIP Experience', status: 'Pending', time: '-' },
  { id: 'g5', name: 'Evan Stone', type: 'General Admission', status: 'Checked In', time: '10:05 AM' },
];

export const MOCK_SOCIAL_POSTS = [
  // Instagram
  {
    id: 'ig1',
    eventId: '1', // Summer Music Festival
    platform: 'instagram',
    author: '@festival_vibes',
    authorName: 'Festival Vibes Official',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    content: 'Can\'t wait for the Summer Music Festival! 🎸🔥 The lineup this year is absolutely insane. Who are you most excited to see? #SummerFest2025 #LiveMusic #FestivalSeason',
    imageUrl: 'https://images.unsplash.com/photo-1533174072545-e8d4aa97d848?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    likes: 3420,
    comments: 145,
    shares: 210,
    date: '2025-06-15T10:30:00Z',
    metrics: {
      impressions: 15400,
      reach: 12300,
      engagementRate: 4.8,
      saved: 890
    },
    sentiment: 'positive',
    commentSummary: 'Overwhelming excitement for the lineup. Users are consistently tagging friends to coordinate tickets. "Best weekend of the year" is a recurring phrase.',
    recentComments: [
      { user: 'musicfan22', text: 'Take my money! 💸', time: '10m ago' },
      { user: 'sarah_j', text: 'Best weekend of the year!', time: '1h ago' }
    ]
  },
  {
    id: 'ig2',
    eventId: '1',
    platform: 'instagram',
    author: '@jessica_sings',
    authorName: 'Jessica Sings',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica',
    content: 'Backstage pass ready! Let\'s rock this! 🤘📸 #BehindTheScenes #VIP',
    imageUrl: 'https://images.unsplash.com/photo-1459749411177-0473ef71607b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    likes: 5200,
    comments: 320,
    shares: 150,
    date: '2025-07-15T18:45:00Z',
    metrics: {
      impressions: 28000,
      reach: 25000,
      engagementRate: 6.2,
      saved: 120
    },
    sentiment: 'positive',
    commentSummary: 'Fans are expressing high FOMO (Fear Of Missing Out) and envy. Strong demand for more behind-the-scenes content in stories.',
    recentComments: [
      { user: 'rocker_dave', text: 'So jealous! Have fun!', time: '5m ago' },
      { user: 'indie_lover', text: 'Post more stories pls!!', time: '12m ago' }
    ]
  },

  // Twitter
  {
    id: 'tw1',
    eventId: '1',
    platform: 'twitter',
    author: '@music_lover_99',
    authorName: 'Music Lover 99',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    content: 'Just got my tickets for the main stage! Who else is going? 🎫✨ #SummerFest',
    imageUrl: null,
    likes: 89,
    comments: 12,
    shares: 34,
    date: '2025-06-16T14:20:00Z',
    metrics: {
      impressions: 1200,
      reach: 800,
      engagementRate: 2.1,
      retweets: 34
    },
    sentiment: 'neutral',
    commentSummary: 'General confirmation of attendance from followers. Several users determining meetup spots near the main stage.',
    recentComments: [
      { user: '@concert_goer', text: 'See you there!', time: '20m ago' }
    ]
  },
  {
    id: 'tw2',
    eventId: '2', // TechConf
    platform: 'twitter',
    author: '@tech_guru_daily',
    authorName: 'Tech Guru Daily',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Tech',
    content: 'Disappointed with the wifi at #TechConfGlobal. Keynote stream keeps buffering. 📉 @ConventionCenter please fix this!',
    imageUrl: null,
    likes: 45,
    comments: 20,
    shares: 5,
    date: '2025-09-10T10:00:00Z',
    metrics: {
      impressions: 3400,
      reach: 3000,
      engagementRate: 1.5,
      retweets: 2
    },
    sentiment: 'negative',
    commentSummary: 'Unified frustration regarding connectivity issues. Specific complaints centered around Hall B. Users demanding immediate vendor response.',
    recentComments: [
      { user: '@dev_ops_guy', text: 'Same here in Hall B.', time: '2m ago' },
      { user: '@network_admin', text: 'Working on it!', time: '1m ago' }
    ]
  },

  // Facebook
  {
    id: 'fb1',
    eventId: '2',
    platform: 'facebook',
    author: 'Tech Conference Official',
    authorName: 'Tech Conference Global',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TechConf',
    content: 'We are excited to announce our keynote speaker for the Global Tech Summit! Stay tuned for a visionary talk on AI and the Future of Work. 🎤💻',
    imageUrl: 'https://images.unsplash.com/photo-1544531586-fde5298cdd40?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    likes: 540,
    comments: 82,
    shares: 150,
    date: '2025-08-01T09:00:00Z',
    metrics: {
      impressions: 8900,
      reach: 6500,
      engagementRate: 3.5,
      clicks: 450
    },
    sentiment: 'positive',
    commentSummary: 'Rampant speculation that the speaker is Sam Altman or Satya Nadella. Sentiment is highly positive with strong anticipation for the AI topic.',
    recentComments: [
      { user: 'Alan Turing Fan', text: 'Is it Sam Altman??', time: '1d ago' },
      { user: 'CodeMaster', text: 'Already registered!', time: '2d ago' }
    ]
  },

  // LinkedIn
  {
    id: 'li1',
    eventId: '3', // Comedy Night (Charity)
    platform: 'linkedin',
    author: 'Sarah Jenkins',
    authorName: 'Sarah Jenkins (Organizer)',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    content: 'Proud to be organizing the Charity Gala & Comedy Night this year. It\'s going to be a night to remember for a great cause. Special thanks to our sponsors. 🥂✨ #Networking #Charity #EventManagement',
    imageUrl: 'https://images.unsplash.com/photo-1519671482538-518b5c2bf5c6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    likes: 450,
    comments: 67,
    shares: 23,
    date: '2025-09-10T11:15:00Z',
    metrics: {
      impressions: 4500,
      reach: 3200,
      engagementRate: 5.1,
      clicks: 320
    },
    sentiment: 'positive',
    commentSummary: 'Professional congratulations and support from corporate partners. Multiple inquiries about remaining sponsorship tier availability.',
    recentComments: [
      { user: 'Corporate Sponsor', text: 'Honored to support this.', time: '3h ago' },
      { user: 'Event Planner NYC', text: 'Looks elegant!', time: '5h ago' }
    ]
  },

  // TikTok (New!)
  {
    id: 'tt1',
    eventId: '1',
    platform: 'tiktok',
    author: '@dance_crew_official',
    authorName: 'Urban Dance Crew',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dance',
    content: 'Rehearsing for the main stage! Watch out for the drop! 💃🕺 #SummerFest #DanceChallenge #FYP',
    imageUrl: 'https://images.unsplash.com/photo-1545128485-c400e7702796?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', // In real app, would be a video thumbnail
    likes: 15400,
    comments: 890,
    shares: 4500,
    date: '2025-07-10T15:00:00Z',
    metrics: {
      impressions: 150000,
      reach: 120000,
      engagementRate: 12.5,
      videoViews: 145000
    },
    sentiment: 'positive',
    commentSummary: 'Viral reaction to the choreography. "Smooth" is the most common adjective. Hundreds of users mentioning they are practicing the challenge.',
    recentComments: [
      { user: 'dancer123', text: 'Smooth moves!', time: '10m ago' },
      { user: 'fest_life', text: 'See you there!!', time: '1h ago' }
    ]
  }
];

export const TICKET_TYPE_DISTRIBUTION = [
  { name: 'VIP', value: 400 },
  { name: 'General', value: 3000 },
  { name: 'Early Bird', value: 1200 },
  { name: 'Student', value: 300 },
];

export const INITIAL_KANBAN_DATA = {
  todo: {
    title: 'To Do',
    items: [
      {
        id: 't1',
        content: 'Update festival lineup images',
        description: 'We need to replace the hero image with the new band photo and update the gallery with last year\'s highlights.',
        priority: 'High',
        tag: 'Design',
        assignee: 'u2',
        messages: [
          { id: 1, text: 'Need the new vector assets by Tuesday.', sender: 'Sarah', time: '2h ago' },
          { id: 2, text: 'On it, exporting them now.', sender: 'Alex', time: '1h ago' }
        ],
        attachments: []
      },
      { id: 't2', content: 'Review vendor contracts', description: '', priority: 'Medium', tag: 'Legal', assignee: 'u1', messages: [], attachments: [] },
    ]
  },
  inProgress: {
    title: 'In Progress',
    items: [
      { id: 't3', content: 'Configure scanner devices', description: 'Ensure all 20 handhelds are charged and have the latest app version.', priority: 'High', tag: 'Ops', assignee: 'u3', messages: [], attachments: [] },
    ]
  },
  review: {
    title: 'Review',
    items: [
      { id: 't4', content: 'Draft promotional email', description: '', priority: 'Low', tag: 'Marketing', assignee: null, messages: [], attachments: [] },
    ]
  },
  done: {
    title: 'Done',
    items: [
      { id: 't5', content: 'Setup Stripe Connect', description: 'Integration complete and tested in sandbox.', priority: 'High', tag: 'Dev', assignee: 'u5', messages: [], attachments: [] },
      { id: 't6', content: 'Venue capacity check', description: 'Fire marshall approved new layout.', priority: 'Medium', tag: 'Ops', assignee: 'u2', messages: [], attachments: [] },
    ]
  }
};

export const COLORS = ['#525252', '#737373', '#a3a3a3', '#d4d4d4'];
export const DARK_COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'];
