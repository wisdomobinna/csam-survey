// src/pages/Completion.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Completion = () => {
  const [fireworks, setFireworks] = useState([]);
  const [shootingStars, setShootingStars] = useState([]);
  const navigate = useNavigate();

  const handleLogout = () => {
    // Add any logout logic here (clearing localStorage, etc)
    navigate('/login');
  };

  const generatePattern = () => {
    const patterns = [
      // Circular pattern
      Array.from({ length: 24 }, (_, i) => ({
        angle: (i * Math.PI * 2) / 24,
        speed: 2 + Math.random(),
        size: 2 + Math.random() * 2
      })),
      // Star pattern
      Array.from({ length: 20 }, (_, i) => ({
        angle: (i * Math.PI * 2) / 10,
        speed: 3 + Math.random(),
        size: 3 + Math.random() * 2
      })),
      // Double ring pattern
      [...Array.from({ length: 16 }, (_, i) => ({
        angle: (i * Math.PI * 2) / 16,
        speed: 2 + Math.random(),
        size: 2 + Math.random() * 2
      })),
      ...Array.from({ length: 16 }, (_, i) => ({
        angle: (i * Math.PI * 2) / 16,
        speed: 4 + Math.random(),
        size: 1 + Math.random()
      }))],
      // Spiral pattern
      Array.from({ length: 30 }, (_, i) => ({
        angle: (i * Math.PI * 8) / 30,
        speed: 1 + (i / 30) * 4,
        size: 3 - (i / 30) * 2
      }))
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  };

  const generateColor = () => {
    const hues = [0, 30, 60, 120, 180, 240, 280, 320];
    return `hsl(${hues[Math.floor(Math.random() * hues.length)]}, 100%, 50%)`;
  };

  useEffect(() => {
    const audio = new Audio('/api/placeholder/audio');
    audio.volume = 0.3;

    const launchFirework = () => {
      const groupSize = 2 + Math.floor(Math.random() * 3);
      const newFireworks = Array.from({ length: groupSize }, () => ({
        id: Math.random(),
        x: 20 + Math.random() * 60,
        y: Math.random() * 40 + 20,
        size: 30 + Math.random() * 40,
        color: generateColor(),
        particles: generatePattern().map(particle => ({
          ...particle,
          color: generateColor()
        }))
      }));

      setFireworks(prev => [...prev, ...newFireworks]);
      audio.currentTime = 0;
      audio.play().catch(() => {});

      setTimeout(() => {
        setFireworks(prev => prev.filter(fw => !newFireworks.find(nfw => nfw.id === fw.id)));
      }, 2000);
    };

    const launchRandomFirework = () => {
      launchFirework();
      const nextDelay = 500 + Math.random() * 1500;
      setTimeout(launchRandomFirework, nextDelay);
    };

    launchRandomFirework();

    const createShootingStar = () => {
      const newStar = {
        id: Math.random(),
        startX: -10,
        startY: Math.random() * 30,
        angle: Math.PI * 0.25,
        speed: 0.5 + Math.random() * 0.5,
        color: generateColor()
      };

      setShootingStars(prev => [...prev, newStar]);

      setTimeout(() => {
        setShootingStars(prev => prev.filter(star => star.id !== newStar.id));
      }, 1000);
    };

    const starInterval = setInterval(createShootingStar, 2000);

    // Cleanup
    return () => {
      clearInterval(starInterval);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      {/* Shooting Stars */}
      {shootingStars.map(star => (
        <div
          key={star.id}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${star.startX}%`,
            top: `${star.startY}%`,
            animation: `shooting-star ${1 / star.speed}s linear forwards`,
            backgroundColor: star.color,
            boxShadow: `0 0 4px ${star.color}, 0 0 8px ${star.color}`
          }}
        />
      ))}

      {/* Fireworks */}
      {fireworks.map(firework => (
        <div
          key={firework.id}
          className="absolute animate-firework"
          style={{
            left: `${firework.x}%`,
            top: `${firework.y}%`,
            zIndex: Math.floor(firework.y)
          }}
        >
          <div 
            className="absolute w-4 h-4 rounded-full animate-explode"
            style={{ backgroundColor: firework.color }}
          >
            {firework.particles.map((particle, i) => (
              <div
                key={i}
                className="absolute rounded-full animate-particle"
                style={{
                  backgroundColor: particle.color,
                  transform: `rotate(${particle.angle}rad) translateX(${particle.speed * 50}px)`,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`
                }}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-20">
        {/* Logout Button */}
        <div className="absolute top-4 right-4">
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md"
          >
            Logout
          </button>
        </div>

        <div className="flex flex-col items-center justify-center space-y-8 text-center">
          <h1 className="text-7xl font-bold text-blue-600 animate-bounce">
            HURRAY!
          </h1>
          
          <div className="text-xl text-gray-700 max-w-2xl animate-fadeIn">
            <p className="mb-4">
              You have completed your evaluations.
              Your participation in this study is greatly appreciated.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shooting-star {
          0% {
            transform: translateX(0) translateY(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateX(1000px) translateY(1000px) scale(0);
            opacity: 0;
          }
        }

        @keyframes firework {
          0% {
            transform: translateY(100vh) scale(0);
          }
          50% {
            transform: translateY(0) scale(1);
          }
          100% {
            transform: translateY(0) scale(1);
          }
        }

        .animate-firework {
          animation: firework 2s ease-out forwards;
        }

        @keyframes explode {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(0);
            opacity: 0;
          }
        }

        .animate-explode {
          animation: explode 0.5s ease-out forwards;
          animation-delay: 1s;
        }

        @keyframes particle {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(0);
            opacity: 0;
          }
        }

        .animate-particle {
          animation: particle 1s ease-out forwards;
          animation-delay: 1s;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Completion;