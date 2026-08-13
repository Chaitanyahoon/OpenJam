'use client';

import React, { useState, useMemo } from 'react';
import { Search, Sparkles } from 'lucide-react';

const CATEGORIES = [
  { id: 'smileys', name: 'Smileys', icon: '😀' },
  { id: 'nature', name: 'Animals & Nature', icon: '🐶' },
  { id: 'food', name: 'Food & Drink', icon: '🍕' },
  { id: 'activities', name: 'Activities', icon: '⚽' },
  { id: 'objects', name: 'Objects & Music', icon: '🎵' },
  { id: 'symbols', name: 'Symbols & Hearts', icon: '❤️' }
];

const EMOJIS = {
  smileys: [
    { char: '😀', tags: ['smiley', 'happy', 'face', 'grin', 'smile', 'joy'] },
    { char: '😃', tags: ['smiley', 'happy', 'face', 'grin', 'smile', 'joy'] },
    { char: '😄', tags: ['smiley', 'happy', 'face', 'grin', 'smile', 'joy'] },
    { char: '😁', tags: ['smiley', 'happy', 'face', 'grin', 'smile'] },
    { char: '😆', tags: ['smiley', 'happy', 'face', 'grin', 'laugh', 'haha'] },
    { char: '😅', tags: ['smiley', 'happy', 'face', 'laugh', 'sweat'] },
    { char: '😂', tags: ['laugh', 'cry', 'tears', 'funny', 'haha', 'lol'] },
    { char: '🤣', tags: ['laugh', 'floor', 'rolling', 'funny', 'haha', 'lol'] },
    { char: '😊', tags: ['smiley', 'happy', 'face', 'smile', 'blush'] },
    { char: '😇', tags: ['smiley', 'happy', 'face', 'angel', 'halo'] },
    { char: '🙂', tags: ['smiley', 'face', 'smile', 'slightly'] },
    { char: '🙃', tags: ['smiley', 'face', 'upside', 'down'] },
    { char: '😉', tags: ['smiley', 'face', 'smile', 'wink'] },
    { char: '😌', tags: ['smiley', 'face', 'relieved'] },
    { char: '😍', tags: ['love', 'heart', 'eyes', 'like', 'admire'] },
    { char: '🥰', tags: ['love', 'hearts', 'face', 'warm'] },
    { char: '😘', tags: ['love', 'kiss', 'blow'] },
    { char: '😗', tags: ['kiss'] },
    { char: '😙', tags: ['kiss', 'eyes'] },
    { char: '😚', tags: ['kiss', 'closed', 'eyes'] },
    { char: '😋', tags: ['face', 'yum', 'delicious', 'tongue'] },
    { char: '😛', tags: ['face', 'tongue', 'playful'] },
    { char: '😝', tags: ['face', 'tongue', 'squint', 'playful'] },
    { char: '😜', tags: ['face', 'tongue', 'wink', 'playful'] },
    { char: '🤪', tags: ['face', 'zany', 'crazy', 'goofy'] },
    { char: '🤨', tags: ['face', 'eyebrow', 'skeptical', 'raising'] },
    { char: '🧐', tags: ['face', 'monocle', 'inspect', 'fancy'] },
    { char: '🤓', tags: ['face', 'nerd', 'geek', 'glasses'] },
    { char: '😎', tags: ['face', 'cool', 'sunglasses', 'chill'] },
    { char: '🥸', tags: ['face', 'disguise', 'mask', 'mustache'] },
    { char: '🤩', tags: ['face', 'star', 'struck', 'excited'] },
    { char: '🥳', tags: ['face', 'party', 'celebrate', 'horn'] },
    { char: '😏', tags: ['face', 'smirk', 'sly'] },
    { char: '😒', tags: ['face', 'unamused', 'bored'] },
    { char: '😞', tags: ['face', 'disappointed', 'sad'] },
    { char: '😔', tags: ['face', 'pensive', 'sad'] },
    { char: '😟', tags: ['face', 'worried', 'sad'] },
    { char: '😕', tags: ['face', 'confused'] },
    { char: '🙁', tags: ['face', 'slightly', 'frown'] },
    { char: '☹️', tags: ['face', 'frown', 'sad'] },
    { char: '😣', tags: ['face', 'persevere', 'struggle'] },
    { char: '😖', tags: ['face', 'confounded'] },
    { char: '😫', tags: ['face', 'tired', 'weary'] },
    { char: '😩', tags: ['face', 'weary', 'tired'] },
    { char: '🥺', tags: ['face', 'pleading', 'beg', 'puppy', 'eyes'] },
    { char: '😢', tags: ['face', 'cry', 'sad', 'tear'] },
    { char: '😭', tags: ['face', 'sob', 'cry', 'sad', 'tears'] },
    { char: '😤', tags: ['face', 'triumph', 'steam', 'angry'] },
    { char: '😠', tags: ['face', 'angry', 'mad'] },
    { char: '😡', tags: ['face', 'pout', 'rage', 'angry', 'red'] },
    { char: '🤬', tags: ['face', 'symbols', 'swear', 'curse', 'angry'] },
    { char: '🤯', tags: ['face', 'explode', 'mind', 'blown'] },
    { char: '😳', tags: ['face', 'flushed', 'blush', 'shocked'] },
    { char: '🥵', tags: ['face', 'hot', 'sweat', 'red', 'fever'] },
    { char: '🥶', tags: ['face', 'cold', 'blue', 'freeze'] },
    { char: '😱', tags: ['face', 'scream', 'fear', 'scared', 'shocked'] },
    { char: '😨', tags: ['face', 'fear', 'scared'] },
    { char: '😰', tags: ['face', 'blue', 'sweat', 'anxious'] },
    { char: '😥', tags: ['face', 'sad', 'relief', 'sweat'] },
    { char: '😓', tags: ['face', 'sweat', 'sad'] },
    { char: '🤗', tags: ['face', 'hug', 'warm'] },
    { char: '🤔', tags: ['face', 'think', 'ponder'] },
    { char: '🤭', tags: ['face', 'hand', 'mouth', 'gasp'] },
    { char: '🤫', tags: ['face', 'shush', 'quiet', 'silent'] },
    { char: '😶', tags: ['face', 'mouth', 'silent'] },
    { char: '😐', tags: ['face', 'neutral', 'meh'] },
    { char: '😑', tags: ['face', 'expressionless'] },
    { char: '😬', tags: ['face', 'grimace', 'awkward'] },
    { char: '🙄', tags: ['face', 'eyes', 'roll', 'bored'] },
    { char: '😴', tags: ['face', 'sleep', 'zzz', 'tired'] },
    { char: '😵', tags: ['face', 'dizzy', 'dead'] },
    { char: '🤐', tags: ['face', 'zipper', 'mouth', 'secret'] },
    { char: '🥴', tags: ['face', 'woozy', 'drunk', 'dizzy'] },
    { char: '🤢', tags: ['face', 'nausea', 'green', 'sick'] },
    { char: '🤮', tags: ['face', 'vomit', 'barf', 'sick'] },
    { char: '🤧', tags: ['face', 'sneeze', 'sick', 'cold'] },
    { char: '😷', tags: ['face', 'mask', 'medical', 'sick'] },
    { char: '🤒', tags: ['face', 'thermometer', 'sick', 'fever'] },
    { char: '🤕', tags: ['face', 'bandage', 'hurt', 'head'] }
  ],
  nature: [
    { char: '🐶', tags: ['dog', 'puppy', 'animal', 'pet'] },
    { char: '🐱', tags: ['cat', 'kitten', 'animal', 'pet'] },
    { char: '🐭', tags: ['mouse', 'animal'] },
    { char: '🐹', tags: ['hamster', 'animal', 'pet'] },
    { char: '🐰', tags: ['bunny', 'rabbit', 'animal'] },
    { char: '🦊', tags: ['fox', 'animal'] },
    { char: '🐻', tags: ['bear', 'animal'] },
    { char: '🐼', tags: ['panda', 'animal'] },
    { char: '🐨', tags: ['koala', 'animal'] },
    { char: '🐯', tags: ['tiger', 'animal'] },
    { char: '🦁', tags: ['lion', 'animal'] },
    { char: '🐮', tags: ['cow', 'animal'] },
    { char: '🐷', tags: ['pig', 'animal'] },
    { char: '🐸', tags: ['frog', 'animal'] },
    { char: '🐵', tags: ['monkey', 'animal'] },
    { char: '🐒', tags: ['monkey', 'animal'] },
    { char: '🐔', tags: ['chicken', 'rooster', 'animal'] },
    { char: '🐧', tags: ['penguin', 'animal'] },
    { char: '🐦', tags: ['bird', 'animal'] },
    { char: '🐤', tags: ['bird', 'chick'] },
    { char: '🐥', tags: ['bird', 'chick'] },
    { char: '🦆', tags: ['duck', 'animal'] },
    { char: '🦅', tags: ['eagle', 'bird'] },
    { char: '🦉', tags: ['owl', 'bird'] },
    { char: '🦇', tags: ['bat', 'animal'] },
    { char: '🐺', tags: ['wolf', 'animal'] },
    { char: '🐗', tags: ['boar', 'pig'] },
    { char: '🐴', tags: ['horse', 'animal'] },
    { char: '🦄', tags: ['unicorn', 'magic'] },
    { char: '🐝', tags: ['bee', 'bug', 'insect', 'honey'] },
    { char: '🐛', tags: ['bug', 'insect', 'caterpillar'] },
    { char: '🦋', tags: ['butterfly', 'bug', 'insect'] },
    { char: '🐌', tags: ['snail', 'bug'] },
    { char: '🐞', tags: ['ladybug', 'bug'] },
    { char: '🐜', tags: ['ant', 'bug'] },
    { char: '🕷️', tags: ['spider', 'bug', 'scary'] },
    { char: '🐢', tags: ['turtle', 'animal'] },
    { char: '🐍', tags: ['snake', 'animal', 'reptile'] },
    { char: '🐙', tags: ['octopus', 'sea', 'ocean'] },
    { char: '🦑', tags: ['squid', 'sea'] },
    { char: '🦞', tags: ['lobster', 'sea', 'food'] },
    { char: '🦀', tags: ['crab', 'sea', 'food'] },
    { char: '🐠', tags: ['fish', 'sea', 'ocean'] },
    { char: '🐬', tags: ['dolphin', 'sea', 'ocean'] },
    { char: '🐳', tags: ['whale', 'sea', 'ocean'] },
    { char: '🦈', tags: ['shark', 'sea', 'ocean'] },
    { char: '🐊', tags: ['alligator', 'crocodile'] },
    { char: '🐅', tags: ['tiger', 'animal'] },
    { char: '🐆', tags: ['leopard', 'animal'] },
    { char: '🦓', tags: ['zebra', 'animal'] },
    { char: '🦍', tags: ['gorilla', 'animal'] },
    { char: '🐘', tags: ['elephant', 'animal'] },
    { char: '🐪', tags: ['camel', 'desert'] },
    { char: '🦒', tags: ['giraffe', 'animal'] },
    { char: '🦘', tags: ['kangaroo', 'australia'] },
    { char: '🦌', tags: ['deer', 'forest'] },
    { char: '🐕', tags: ['dog', 'animal'] },
    { char: '🐈', tags: ['cat', 'animal'] },
    { char: '🐓', tags: ['rooster', 'chicken'] },
    { char: '🕊️', tags: ['dove', 'bird', 'peace'] },
    { char: '🐇', tags: ['rabbit', 'bunny'] },
    { char: '🦝', tags: ['raccoon', 'animal'] },
    { char: '🌲', tags: ['tree', 'forest', 'pine'] },
    { char: '🌳', tags: ['tree', 'forest', 'deciduous'] },
    { char: '🌴', tags: ['tree', 'palm', 'beach', 'tropical'] },
    { char: '🌱', tags: ['sprout', 'plant', 'leaf'] },
    { char: '🌿', tags: ['herb', 'plant', 'leaf'] },
    { char: '🍀', tags: ['clover', 'lucky', 'green'] },
    { char: '🍁', tags: ['maple', 'leaf', 'autumn', 'canada'] },
    { char: '🍂', tags: ['fallen', 'leaves', 'autumn'] },
    { char: '🍃', tags: ['leaves', 'wind', 'blowing'] }
  ],
  food: [
    { char: '🍏', tags: ['apple', 'green', 'fruit'] },
    { char: '🍎', tags: ['apple', 'red', 'fruit'] },
    { char: '🍐', tags: ['pear', 'fruit'] },
    { char: '🍊', tags: ['orange', 'citrus', 'fruit'] },
    { char: '🍋', tags: ['lemon', 'citrus', 'fruit'] },
    { char: '🍌', tags: ['banana', 'fruit'] },
    { char: '🍉', tags: ['watermelon', 'fruit'] },
    { char: '🍇', tags: ['grapes', 'fruit'] },
    { char: '🍓', tags: ['strawberry', 'fruit'] },
    { char: '🍒', tags: ['cherry', 'fruit'] },
    { char: '🍑', tags: ['peach', 'fruit'] },
    { char: '🍍', tags: ['pineapple', 'fruit', 'tropical'] },
    { char: '🥥', tags: ['coconut', 'fruit', 'tropical'] },
    { char: '🥝', tags: ['kiwi', 'fruit'] },
    { char: '🍅', tags: ['tomato', 'vegetable'] },
    { char: '🥑', tags: ['avocado', 'guacamole'] },
    { char: '🌽', tags: ['corn', 'vegetable'] },
    { char: '🥕', tags: ['carrot', 'vegetable'] },
    { char: '🥔', tags: ['potato', 'vegetable'] },
    { char: '🥐', tags: ['croissant', 'bread', 'bakery'] },
    { char: '🍞', tags: ['bread', 'loaf', 'toast'] },
    { char: '🥖', tags: ['baguette', 'bread', 'french'] },
    { char: '🧀', tags: ['cheese', 'dairy'] },
    { char: '🍖', tags: ['meat', 'bone'] },
    { char: '🍗', tags: ['chicken', 'leg', 'poultry'] },
    { char: '🥓', tags: ['bacon', 'pork'] },
    { char: '🍔', tags: ['hamburger', 'burger', 'fastfood'] },
    { char: '🍟', tags: ['fries', 'potato', 'fastfood'] },
    { char: '🍕', tags: ['pizza', 'cheese', 'fastfood'] },
    { char: '🌭', tags: ['hotdog', 'fastfood'] },
    { char: '🥪', tags: ['sandwich', 'lunch'] },
    { char: '🌮', tags: ['taco', 'mexican'] },
    { char: '🌯', tags: ['burrito', 'mexican'] },
    { char: '🥚', tags: ['egg'] },
    { char: '🍳', tags: ['cooking', 'egg', 'pan'] },
    { char: '🍲', tags: ['stew', 'soup', 'bowl'] },
    { char: '🥗', tags: ['salad', 'healthy', 'greens'] },
    { char: '🍿', tags: ['popcorn', 'movie', 'snack'] },
    { char: '🍣', tags: ['sushi', 'japanese', 'fish'] },
    { char: '🍤', tags: ['shrimp', 'tempura', 'fried'] },
    { char: '🍩', tags: ['donut', 'sweet', 'bakery'] },
    { char: '🍪', tags: ['cookie', 'chocolate', 'sweet'] },
    { char: '🎂', tags: ['cake', 'birthday', 'sweet'] },
    { char: '🧁', tags: ['cupcake', 'sweet'] },
    { char: '🥧', tags: ['pie', 'sweet'] },
    { char: '🍫', tags: ['chocolate', 'candy', 'sweet'] },
    { char: '🍬', tags: ['candy', 'sweet'] },
    { char: '🍭', tags: ['lollipop', 'sweet'] },
    { char: '🍯', tags: ['honey', 'pot', 'sweet'] },
    { char: '🥛', tags: ['milk', 'glass'] },
    { char: '☕', tags: ['coffee', 'cup', 'hot', 'caffeine'] },
    { char: '🍵', tags: ['tea', 'green', 'japanese'] },
    { char: '🍷', tags: ['wine', 'glass', 'alcohol'] },
    { char: '🍸', tags: ['cocktail', 'glass', 'martini'] },
    { char: '🍹', tags: ['tropical', 'drink', 'cocktail'] },
    { char: '🍺', tags: ['beer', 'mug', 'alcohol'] },
    { char: '🍻', tags: ['beers', 'clinking', 'cheers'] },
    { char: '🥂', tags: ['glasses', 'clinking', 'champagne', 'celebrate'] },
    { char: '🥤', tags: ['soda', 'cup', 'straw'] }
  ],
  activities: [
    { char: '⚽', tags: ['soccer', 'football', 'ball', 'sports'] },
    { char: '🏀', tags: ['basketball', 'ball', 'sports'] },
    { char: '🏈', tags: ['football', 'ball', 'sports'] },
    { char: '⚾', tags: ['baseball', 'ball', 'sports'] },
    { char: '🎾', tags: ['tennis', 'ball', 'sports'] },
    { char: '🏐', tags: ['volleyball', 'ball', 'sports'] },
    { char: '🏉', tags: ['rugby', 'ball', 'sports'] },
    { char: '🎱', tags: ['billiards', 'pool', '8ball'] },
    { char: '🏓', tags: ['pingpong', 'table', 'tennis'] },
    { char: '🏸', tags: ['badminton', 'shuttlecock'] },
    { char: '🏒', tags: ['hockey', 'ice'] },
    { char: '🏏', tags: ['cricket', 'bat', 'ball'] },
    { char: '🛹', tags: ['skateboard', 'skate'] },
    { char: '🎿', tags: ['ski', 'snow'] },
    { char: '🏂', tags: ['snowboard', 'snow'] },
    { char: '🎳', tags: ['bowling', 'pins'] },
    { char: '⛳', tags: ['golf', 'hole'] },
    { char: '🎯', tags: ['darts', 'target', 'bullseye'] },
    { char: '♟️', tags: ['chess', 'board'] },
    { char: '🎮', tags: ['game', 'controller', 'playstation', 'xbox'] },
    { char: '🕹️', tags: ['joystick', 'arcade', 'retro'] },
    { char: '🎰', tags: ['slot', 'machine', 'casino', 'gamble'] },
    { char: '🧩', tags: ['puzzle', 'jigsaw'] },
    { char: '🎭', tags: ['drama', 'masks', 'theater', 'act'] },
    { char: '🎨', tags: ['palette', 'art', 'paint', 'draw'] }
  ],
  objects: [
    { char: '🎵', tags: ['music', 'note', 'song', 'sing'] },
    { char: '🎶', tags: ['music', 'notes', 'song', 'sing'] },
    { char: '📻', tags: ['radio', 'music', 'podcast'] },
    { char: '🎸', tags: ['guitar', 'music', 'instrument', 'rock'] },
    { char: '🎹', tags: ['piano', 'keyboard', 'music', 'instrument'] },
    { char: '🎺', tags: ['trumpet', 'music', 'instrument', 'jazz'] },
    { char: '🎻', tags: ['violin', 'music', 'instrument'] },
    { char: '🥁', tags: ['drum', 'music', 'instrument', 'beat'] },
    { char: '🎤', tags: ['microphone', 'sing', 'karaoke', 'music'] },
    { char: '🎧', tags: ['headphones', 'listen', 'music', 'audio'] },
    { char: '🎬', tags: ['clapperboard', 'movie', 'film'] },
    { char: '🎫', tags: ['ticket', 'concert', 'movie'] },
    { char: '🏆', tags: ['trophy', 'winner', 'gold', 'award'] },
    { char: '🏅', tags: ['medal', 'award', 'sports'] },
    { char: '💻', tags: ['computer', 'laptop', 'tech'] },
    { char: '📱', tags: ['phone', 'mobile', 'smartphone'] },
    { char: '⌚', tags: ['watch', 'time', 'clock'] },
    { char: '💿', tags: ['cd', 'dvd', 'disc', 'music'] },
    { char: '📷', tags: ['camera', 'photo', 'picture'] },
    { char: '🔍', tags: ['magnifier', 'search', 'zoom', 'find'] },
    { char: '💡', tags: ['lightbulb', 'idea', 'glow'] },
    { char: '🔦', tags: ['flashlight', 'light'] },
    { char: '📔', tags: ['notebook', 'journal', 'book'] },
    { char: '📖', tags: ['book', 'open', 'read'] },
    { char: '✉️', tags: ['envelope', 'mail', 'letter'] },
    { char: '✏️', tags: ['pencil', 'write', 'draw'] },
    { char: '🔒', tags: ['lock', 'closed', 'secure'] },
    { char: '🔑', tags: ['key', 'unlock', 'secure'] },
    { char: '🔨', tags: ['hammer', 'tool', 'build'] },
    { char: '🔧', tags: ['wrench', 'tool', 'fix'] }
  ],
  symbols: [
    { char: '❤️', tags: ['heart', 'red', 'love'] },
    { char: '🧡', tags: ['heart', 'orange', 'love'] },
    { char: '💛', tags: ['heart', 'yellow', 'love'] },
    { char: '💚', tags: ['heart', 'green', 'love'] },
    { char: '💙', tags: ['heart', 'blue', 'love'] },
    { char: '💜', tags: ['heart', 'purple', 'love'] },
    { char: '🖤', tags: ['heart', 'black', 'love'] },
    { char: '🤍', tags: ['heart', 'white', 'love'] },
    { char: '🤎', tags: ['heart', 'brown', 'love'] },
    { char: '💔', tags: ['heart', 'broken', 'sad'] },
    { char: '❣️', tags: ['heart', 'exclamation'] },
    { char: '💕', tags: ['hearts', 'love', 'two'] },
    { char: '💞', tags: ['hearts', 'revolving', 'love'] },
    { char: '💓', tags: ['heart', 'beating', 'love'] },
    { char: '💗', tags: ['heart', 'growing', 'love'] },
    { char: '💖', tags: ['heart', 'sparkle', 'love'] },
    { char: '💘', tags: ['heart', 'arrow', 'cupid'] },
    { char: '💝', tags: ['heart', 'ribbon', 'gift'] },
    { char: '✨', tags: ['sparkles', 'magic', 'shiny', 'glow'] },
    { char: '🔥', tags: ['fire', 'flame', 'hot', 'lit', 'trending'] },
    { char: '⭐', tags: ['star', 'yellow', 'gold'] },
    { char: '🌟', tags: ['star', 'sparkle', 'glowing'] },
    { char: '💥', tags: ['explosion', 'collision', 'bang'] },
    { char: '💯', tags: ['hundred', 'score', 'perfect'] },
    { char: '💬', tags: ['speech', 'bubble', 'chat', 'talk'] },
    { char: '💭', tags: ['thought', 'bubble', 'think'] },
    { char: '💤', tags: ['zzz', 'sleep', 'snore'] },
    { char: '⚠️', tags: ['warning', 'alert', 'danger'] },
    { char: '🚫', tags: ['prohibited', 'ban', 'stop', 'no'] },
    { char: '☮️', tags: ['peace', 'symbol'] },
    { char: '☯️', tags: ['yin', 'yang', 'balance'] },
    { char: '◀️', tags: ['back', 'arrow', 'left'] },
    { char: '▶️', tags: ['play', 'arrow', 'right'] },
    { char: '⏸️', tags: ['pause', 'stop'] },
    { char: '⏹️', tags: ['stop', 'square'] },
    { char: '🔁', tags: ['repeat', 'loop'] }
  ]
};

export default function EmojiPicker({ onSelect, style = {} }) {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEmojis = useMemo(() => {
    if (!searchQuery.trim()) {
      return EMOJIS[activeCategory] || [];
    }
    const cleanQuery = searchQuery.toLowerCase().trim();
    const matches = [];
    Object.values(EMOJIS).forEach((list) => {
      list.forEach((emoji) => {
        if (emoji.tags.some(tag => tag.includes(cleanQuery))) {
          matches.push(emoji);
        }
      });
    });
    // Deduplicate
    const seen = new Set();
    return matches.filter((item) => {
      if (seen.has(item.char)) return false;
      seen.add(item.char);
      return true;
    });
  }, [activeCategory, searchQuery]);

  return (
    <div 
      className="emoji-picker-popover"
      style={{
        width: '280px',
        background: 'rgba(15, 14, 18, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 159, 28, 0.25)',
        borderRadius: '16px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 1001,
        color: '#fff',
        userSelect: 'none',
        ...style
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Category selector */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: '8px',
          gap: '4px'
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            title={cat.name}
            onClick={() => {
              setActiveCategory(cat.id);
              setSearchQuery('');
            }}
            style={{
              background: activeCategory === cat.id && !searchQuery ? 'rgba(255, 159, 28, 0.15)' : 'none',
              border: activeCategory === cat.id && !searchQuery ? '1px solid rgba(255, 159, 28, 0.3)' : '1px solid transparent',
              borderRadius: '8px',
              fontSize: '18px',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              outline: 'none'
            }}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search emojis..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            padding: '6px 12px 6px 32px',
            fontSize: '12px',
            color: '#fff',
            outline: 'none',
            transition: 'border 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(255, 159, 28, 0.4)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
        />
        <Search 
          size={14} 
          style={{
            position: 'absolute',
            left: '10px',
            opacity: 0.4,
            pointerEvents: 'none'
          }} 
        />
      </div>

      {/* Emoji Grid */}
      <div 
        style={{
          height: '180px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '6px',
          paddingRight: '4px'
        }}
        className="custom-scrollbar"
      >
        {filteredEmojis.length > 0 ? (
          filteredEmojis.map((emoji) => (
            <button
              key={emoji.char}
              type="button"
              onClick={() => onSelect(emoji.char)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                width: '100%',
                aspectRatio: '1',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.15s, background 0.15s',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.transform = 'scale(1.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              {emoji.char}
            </button>
          ))
        ) : (
          <div 
            style={{
              gridColumn: 'span 7',
              textAlign: 'center',
              padding: '36px 0',
              color: '#666',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={16} style={{ opacity: 0.3 }} />
            No emojis found
          </div>
        )}
      </div>
    </div>
  );
}
