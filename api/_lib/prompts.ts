export interface Prompt {
  day: number;
  type: 'photo' | 'reflection';
  /** Short line for the notification title area and the day chip. */
  title: string;
  /** The invitation itself, shown above the capture button. */
  text: string;
}

export const PROMPTS: Prompt[] = [
  { day: 1, type: 'reflection', title: 'What came home with you',
    text: "You're home. What came back inside you that you didn't pack — a feeling, a question, a small resolve?" },
  { day: 2, type: 'photo', title: 'Something you tend',
    text: "Something growing near you. Let it stand for whatever you're quietly tending in yourself, and photograph that." },
  { day: 3, type: 'photo', title: 'Where you begin',
    text: 'Your altar, your corner, the place you sit. Photograph it — and notice what quietens in you when you settle there.' },
  { day: 4, type: 'reflection', title: 'A line that stayed',
    text: 'One line from a teacher that has stayed with you. Write it as you remember it, and why you think this is the one that stayed.' },
  { day: 5, type: 'photo', title: 'The sky, and you',
    text: 'The sky right now. Does it match what you feel inside, or argue with it? Photograph it either way.' },
  { day: 6, type: 'photo', title: 'What your hands carried',
    text: 'Your hands today. What did they carry that no one else could see?' },
  { day: 7, type: 'reflection', title: 'How the morning really went',
    text: 'How did your morning actually go — the true version, not the tidy one?' },
  { day: 8, type: 'photo', title: 'A flame, and a wish',
    text: 'A flame you lit today — a diya, a candle, a stove. What were you quietly hoping for as it caught?' },
  { day: 9, type: 'reflection', title: 'One gratitude',
    text: 'One gratitude. Small is welcome. Small is often truer.' },
  { day: 10, type: 'photo', title: 'Water, and a mood',
    text: 'Water, wherever you find it. Which of your moods does it look like today?' },
  { day: 11, type: 'reflection', title: 'Where the divine was',
    text: 'Where did you feel the divine today? It is allowed to be somewhere completely ordinary.' },
  { day: 12, type: 'photo', title: 'Something loosened',
    text: 'Something that loosened something in you this last hour. Photograph it.' },
  { day: 13, type: 'photo', title: 'What you crossed',
    text: 'A threshold you passed through today. What did you leave on one side of it?' },
  { day: 14, type: 'reflection', title: 'Set it down',
    text: "What are you carrying from the yatra that has started to feel heavy? You can set it down here." },
  { day: 15, type: 'photo', title: 'Where you actually are',
    text: "Halfway. Photograph your feet — and ask whether you're standing where you thought you'd be by now." },
  { day: 16, type: 'photo', title: 'Given or received',
    text: 'Food you made, shared, or were given today. Which felt better — the giving, or the receiving?' },
  { day: 17, type: 'reflection', title: 'Someone on your mind',
    text: 'Who from the yatra has been on your mind this week, and what brought them there?' },
  { day: 18, type: 'photo', title: 'A colour that matched you',
    text: 'A colour that found you today. What were you feeling the moment it caught your eye?' },
  { day: 19, type: 'reflection', title: 'A moment of stillness',
    text: 'A moment of stillness you caught today — how long was it, and what was inside it?' },
  { day: 20, type: 'photo', title: 'What it stirs',
    text: 'Something old in your home. Photograph it, and notice what it stirs when you hold it.' },
  { day: 21, type: 'photo', title: 'What you look for',
    text: 'The view from a window you know well. What do you find yourself looking for out there?' },
  { day: 22, type: 'reflection', title: 'What has shifted',
    text: 'What has quietly changed in you since you came home? Even something very small counts.' },
  { day: 23, type: 'photo', title: 'Service, noticed',
    text: "Hands that served today — yours, or someone's you noticed. What did it stir to watch?" },
  { day: 24, type: 'reflection', title: 'Words you keep',
    text: 'A prayer, a mantra, or a sentence you say quietly to yourself. Share one, and when you reach for it.' },
  { day: 25, type: 'photo', title: 'Almost missed',
    text: 'Something you almost walked past, then noticed. Why do you think it caught you?' },
  { day: 26, type: 'photo', title: 'What evening brings up',
    text: 'The evening, wherever it finds you. What does this hour tend to bring up in you?' },
  { day: 27, type: 'reflection', title: "What you'll keep",
    text: 'What do you want to keep doing once these thirty days are over?' },
  { day: 28, type: 'photo', title: 'A face you love',
    text: 'A face you love. Before you take it — what does looking at them settle in you? (Ask them first, and tell them it is for the yatra group.)' },
  { day: 29, type: 'photo', title: 'The same frame',
    text: "Your altar again — the same frame as Day 2, if you can manage it. What has shifted, in the corner and in you?" },
  { day: 30, type: 'reflection', title: 'Thirty drops',
    text: 'Thirty days of flow. Walk back through the whole gallery slowly first. Then tell us — what did this month stir in you?' },
];

export function promptForDay(day: number): Prompt | null {
  return PROMPTS.find((prompt) => prompt.day === day) ?? null;
}