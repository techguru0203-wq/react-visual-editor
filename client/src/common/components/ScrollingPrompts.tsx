import { useEffect, useState } from 'react';

import './ScrollingPrompts.scss';

const prompts = [
  'Make a SaaS app that ...',
  'Make an AI app that ...',
  'Build a task management system that ...',
  'Create a social media dashboard that ...',
  'Build an e-commerce store that ...',
  'Make a calendar scheduling app that ...',
  'Create a fitness tracking app that ...',
  'Build a project management tool that ...',
  'Make a blog platform that ...',
  'Create a real-time chat app that ...',
  'Build a weather forecast app that ...',
  'Make a recipe sharing platform that ...',
  'Create an inventory management system that ...',
  'Build a CRM for a small business that ...',
  'Make a music streaming app that ...',
  'Create a video conferencing tool that ...',
  'Build a note-taking app that ...',
  'Make an expense tracker that ...',
  'Create a learning management system that ...',
  'Build a booking reservation system that ...',
];

// Mapping between categories and their corresponding prompts
const categoryPromptMap: Record<string, string> = {
  ai: 'Make an AI app that ...',
  'SMB Portal': 'Build a CRM for a small business that ...',
  SMBPortal: 'Build a CRM for a small business that ...',
  saas: 'Make a SaaS app that ...',
  internal: 'Build a project management tool that ...',
};

interface ScrollingPromptsProps {
  selectedCategory?: string;
}

const ScrollingPrompts: React.FC<ScrollingPromptsProps> = ({
  selectedCategory,
}) => {
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(100);
  const [isStopped, setIsStopped] = useState(false);

  // Find the target prompt based on selected category
  // For "all" category, no target prompt (continue normal scrolling)
  const targetPrompt =
    selectedCategory && selectedCategory !== 'all'
      ? categoryPromptMap[selectedCategory]
      : null;
  const targetPromptIndex = targetPrompt
    ? prompts.findIndex((prompt) => prompt === targetPrompt)
    : -1;

  useEffect(() => {
    const currentPrompt = prompts[currentPromptIndex];

    const handleTyping = () => {
      // If we have a target prompt and we've reached it, stop the animation
      if (
        targetPromptIndex !== -1 &&
        currentPromptIndex === targetPromptIndex &&
        !isDeleting &&
        displayedText === currentPrompt
      ) {
        setIsStopped(true);
        return;
      }

      // If animation is stopped, don't continue
      if (isStopped) {
        return;
      }

      // If we have a target prompt and we're not at it yet, don't continue normal scrolling
      if (
        targetPromptIndex !== -1 &&
        currentPromptIndex !== targetPromptIndex
      ) {
        // Jump to the target prompt
        setCurrentPromptIndex(targetPromptIndex);
        setDisplayedText('');
        setIsDeleting(false);
        setTypingSpeed(100);
        return;
      }

      if (!isDeleting) {
        // Typing forward
        if (displayedText.length < currentPrompt.length) {
          setDisplayedText(
            currentPrompt.substring(0, displayedText.length + 1)
          );
          setTypingSpeed(100);
        } else {
          // Finished typing, wait then start deleting
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        // Deleting backward
        if (displayedText.length > 0) {
          setDisplayedText(
            currentPrompt.substring(0, displayedText.length - 1)
          );
          setTypingSpeed(50);
        } else {
          // Finished deleting, move to next prompt
          setIsDeleting(false);
          setCurrentPromptIndex(
            (prevIndex) => (prevIndex + 1) % prompts.length
          );
          setTypingSpeed(100);
        }
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);

    return () => clearTimeout(timer);
  }, [
    displayedText,
    isDeleting,
    currentPromptIndex,
    typingSpeed,
    targetPromptIndex,
    isStopped,
  ]);

  // Reset animation when category changes
  useEffect(() => {
    if (selectedCategory) {
      // If "all" is selected, resume normal scrolling through all prompts
      if (selectedCategory === 'all') {
        setIsStopped(false);
        // Continue with normal animation - don't jump to specific prompt
        // The animation will cycle through all prompts naturally
        return;
      }

      // For other categories, stop at the target prompt
      setIsStopped(false);
      // If we have a target prompt, jump to it and prepare to stop
      if (targetPromptIndex !== -1) {
        setCurrentPromptIndex(targetPromptIndex);
        setDisplayedText('');
        setIsDeleting(false);
        setTypingSpeed(100);
        // The animation will stop once it reaches the target prompt
      }
    }
  }, [selectedCategory, targetPromptIndex]);

  return (
    <div className="scrolling-prompts-container">
      <div className="typing-prompts-wrapper">
        <span className="typing-prompt-text">
          {displayedText}
          <span className="typing-cursor">|</span>
        </span>
      </div>
    </div>
  );
};

export default ScrollingPrompts;
