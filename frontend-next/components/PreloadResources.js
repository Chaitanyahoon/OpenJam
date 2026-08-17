'use client';
import ReactDOM from 'react-dom';

export function PreloadResources() {
  ReactDOM.preconnect('https://i.ytimg.com', { crossOrigin: 'anonymous' });
  ReactDOM.preconnect('https://img.youtube.com', { crossOrigin: 'anonymous' });
  ReactDOM.preconnect('https://lrclib.net', { crossOrigin: 'anonymous' });
  ReactDOM.preconnect('https://api.openjam.fun', { crossOrigin: 'anonymous' });
  ReactDOM.preload('https://www.openjam.fun/static/img/hero_visual_showcase.webp', { as: 'image', fetchPriority: 'high' });
  return null;
}
