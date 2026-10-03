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
  { day: 2, type: 'reflection', title: 'Where you begin',
    text: 'Your altar, your corner, the place you sit. What quietens in you when you settle there?' },
  { day: 3, type: 'reflection', title: 'Something you tend',
    text: 'Something growing near you. What are you quietly tending in yourself right now?' },
  { day: 4, type: 'reflection', title: 'A line that stayed',
    text: 'One line from a teacher that has stayed with you. Write it as you remember it, and why you think this is the one that stayed.' },
  { day: 5, type: 'reflection', title: 'The sky, and you',
    text: 'Look at the sky right now. Does it match what you feel inside, or argue with it?' },
  { day: 6, type: 'reflection', title: 'What your hands carried',
    text: 'Your hands today. What did they carry that no one else could see?' },
  { day: 7, type: 'reflection', title: 'How the morning really went',
    text: 'How did your morning actually go — the true version, not the tidy one?' },
  { day: 8, type: 'reflection', title: 'A flame, and a wish',
    text: 'A flame you lit today — a diya, a candle, a stove. What were you quietly hoping for as it caught?' },
  { day: 9, type: 'reflection', title: 'One gratitude',
    text: 'One gratitude. Small is welcome. Small is often truer.' },
  { day: 10, type: 'reflection', title: 'Water, and a mood',
    text: 'Water, wherever you find it. Which of your moods does it look like today?' },
  { day: 11, type: 'reflection', title: 'Where the divine was',
    text: 'Where did you feel the divine today? It is allowed to be somewhere completely ordinary.' },
  { day: 12, type: 'reflection', title: 'Something loosened',
    text: 'What loosened something in you this last hour?' },
  { day: 13, type: 'reflection', title: 'What you crossed',
    text: 'A threshold you passed through today. What did you leave on one side of it?' },
  { day: 14, type: 'reflection', title: 'Set it down',
    text: "What are you carrying from the yatra that has started to feel heavy? You can set it down here." },
  { day: 15, type: 'reflection', title: 'Toward, or behind',
    text: "Halfway through. What are you walking toward, or what are you leaving behind? Answer whichever one is truer today." },
  { day: 16, type: 'reflection', title: 'Given or received',
    text: 'Food you made, shared, or were given today. Which felt better — the giving, or the receiving?' },
  { day: 17, type: 'reflection', title: 'Someone on your mind',
    text: 'Who from the yatra has been on your mind this week, and what brought them there?' },
  { day: 18, type: 'reflection', title: 'A colour that matched you',
    text: 'A colour that found you today. What were you feeling the moment it caught your eye?' },
  { day: 19, type: 'reflection', title: 'A moment of stillness',
    text: 'A moment of stillness you caught today — how long was it, and what was inside it?' },
  { day: 20, type: 'reflection', title: 'What it stirs',
    text: 'Something old in your home. What does it stir when you hold it?' },
  { day: 21, type: 'reflection', title: 'What you look for',
    text: 'The view from a window you know well. What do you find yourself looking for out there?' },
  { day: 22, type: 'reflection', title: 'What has shifted',
    text: 'What has quietly changed in you since you came home? Even something very small counts.' },
  { day: 23, type: 'reflection', title: 'Service, noticed',
    text: "Hands that served today — yours, or someone's you noticed. What did it stir to watch?" },
  { day: 24, type: 'reflection', title: 'Words you keep',
    text: 'A prayer, a mantra, or a sentence you say quietly to yourself. Share one, and when you reach for it.' },
  { day: 25, type: 'reflection', title: 'Almost missed',
    text: 'Something you almost walked past, then noticed. Why do you think it caught you?' },
  { day: 26, type: 'reflection', title: 'What evening brings up',
    text: 'The evening, wherever it finds you. What does this hour tend to bring up in you?' },
  { day: 27, type: 'reflection', title: "What you'll keep",
    text: 'What do you want to keep doing once these thirty days are over?' },
  { day: 28, type: 'reflection', title: 'A face you love',
    text: 'A face you love. What does looking at them settle in you? (If you share a photo, ask them first and tell them it is for the yatra group.)' },
  { day: 29, type: 'reflection', title: 'The same frame',
    text: 'Your altar or corner again, the one from Day 2. What has shifted, in the corner and in you?' },
  { day: 30, type: 'reflection', title: 'Thirty drops',
    text: 'Thirty days of flow. Walk back through the whole gallery slowly first. Then tell us — what did this month stir in you?' },
];

export function promptForDay(day: number): Prompt | null {
  return PROMPTS.find((prompt) => prompt.day === day) ?? null;
}