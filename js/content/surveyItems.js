// The "Player Profile" onboarding quiz — port of SurveyItems.swift.
//
// Stated-preference items are mixed with gaming-habit distractors (F*) to mask
// the study's privacy focus. Mapping to behavioral measures:
//   S2                    -> policy reading (disclosure 1)
//   S9                    -> overall privacy concern
//   S10_* / S11_* / S12_* -> traceability importance / trust / willingness to
//                            share data types, per entity (ads partners map to
//                            the third-party toggle; "Access to your contacts"
//                            maps to disclosure 2; "Your precise location"
//                            maps to disclosure 3)
//
// Item kinds:
//   likert      — five ordered labels; the 1–5 index is logged
//   choice      — categorical options; the chosen label is logged
//   multiChoice — select-all-that-apply; selected labels logged as an array
//                 (an empty array = nothing selected)

const entities = [
  { id: 'ads', label: "the game's advertising partners" },
  { id: 'dev', label: "the app's developers" },
  { id: 'players', label: 'other players' },
];

const importanceScale = ['1 · Not at all', '2', '3', '4', '5 · Very important'];
const trustScale = ['1 · Not at all', '2', '3', '4', '5 · Completely'];

const dataTypes = [
  'Full name',
  'Email address',
  'Mobile phone number',
  'Your precise location',
  'Age',
  'Gender',
  'Gameplay history',
  'Access to your contacts',
  "Access to other apps' data",
  'Profile picture',
  'Camera roll',
];

const items = [
  {
    id: 'F1',
    prompt: 'About how many hours a week do you spend playing mobile games?',
    kind: 'choice',
    options: ['Less than 1', '1–3', '4–7', '8–14', '15 or more'],
  },
  {
    id: 'F2',
    prompt: 'Which game genre do you play most?',
    kind: 'choice',
    options: ['Puzzle', 'Action / arcade', 'Strategy', 'Word / trivia', 'Other'],
  },
  {
    id: 'F3',
    prompt: 'How would you describe your playing style?',
    kind: 'likert',
    options: ['Very cooperative', 'Cooperative', 'Mixed', 'Competitive', 'Very competitive'],
  },
  {
    id: 'F5',
    prompt: 'Who do you like to play mobile games with the most?',
    kind: 'choice',
    options: ['Alone', 'With one friend', 'With several friends', "With people I don't know online", 'No preference'],
  },
  {
    id: 'F6',
    prompt: 'How often do you play mobile games with other people?',
    kind: 'likert',
    options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Very often'],
  },
  {
    id: 'S2',
    prompt: 'When you install a new app, how often do you read the privacy policy?',
    kind: 'likert',
    options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
  },
  {
    id: 'F7',
    prompt: 'What would make you more likely to play mobile games with others?',
    kind: 'choice',
    options: [
      'Higher scores',
      'More rewards',
      'Unlocking new levels',
      'Competing against others',
      'Cooperating with friends',
      'Meeting new players',
      'I prefer playing alone',
    ],
  },
  {
    id: 'S9',
    prompt: 'How concerned are you about your privacy when using mobile game apps?',
    kind: 'likert',
    options: ['1 · Not at all concerned', '2', '3', '4', '5 · Extremely concerned'],
  },
];

for (const entity of entities) {
  items.push({
    id: `S10_${entity.id}`,
    prompt: `How important is it that your use of a mobile game is not traceable by ${entity.label}?`,
    kind: 'likert',
    options: importanceScale,
  });
}

for (const entity of entities) {
  items.push({
    id: `S11_${entity.id}`,
    prompt: `To what extent do you trust ${entity.label} to responsibly handle personal data collected through a mobile game?`,
    kind: 'likert',
    options: trustScale,
  });
}

for (const entity of entities) {
  items.push({
    id: `S12_${entity.id}`,
    prompt: `What types of personal data are you willing to share with ${entity.label}? Select all that apply.`,
    kind: 'multiChoice',
    options: dataTypes,
  });
}

items.push(
  {
    id: 'F4',
    prompt: 'Have you played a snake game before?',
    kind: 'choice',
    options: ['Never', 'Once or twice', 'A few times', 'Many times'],
  },
  {
    id: 'D1',
    prompt: 'What is your age?',
    kind: 'choice',
    options: ['18–24', '25–34', '35–44', '45–54', '55 or older'],
  },
  {
    id: 'D2',
    prompt: 'How do you describe your gender?',
    kind: 'choice',
    options: ['Woman', 'Man', 'Non-binary', 'Prefer not to say'],
  }
);

export const surveyItems = items;
