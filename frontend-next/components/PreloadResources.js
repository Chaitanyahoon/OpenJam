'use client';
import ReactDOM from 'react-dom';

export function PreloadResources() {
  ReactDOM.preconnect('https://i.ytimg.com');
  ReactDOM.preconnect('https://www.youtube.com');
  return null;
}
