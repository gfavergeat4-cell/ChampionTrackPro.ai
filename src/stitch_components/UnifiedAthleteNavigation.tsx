import React from 'react';

interface UnifiedAthleteNavigationProps {
  activeTab: 'Home' | 'Schedule' | 'Profile';
  onNavigate: (tab: 'Home' | 'Schedule' | 'Profile') => void;
}

export default function UnifiedAthleteNavigation({ activeTab, onNavigate }: UnifiedAthleteNavigationProps) {
  const tabs = [
    { id: 'Home', label: 'Home', icon: 'home' },
    { id: 'Schedule', label: 'Schedule', icon: 'calendar' },
    { id: 'Profile', label: 'Profile', icon: 'profile' }
  ];

  const getIcon = (iconName: string, isActive: boolean, filterId?: string) => {
    const size = 20; // Increased for better visibility
    const activeColor = '#00EAFF';
    const inactiveColor = '#9CA3AF';
    const strokeWidth = isActive ? '2' : '1.5';
    const color = isActive ? activeColor : inactiveColor;
    
    switch (iconName) {
      case 'home':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {isActive && filterId ? (
              // Filled/glowing version for active state
              <>
                <defs>
                  <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <mask id={`homeMask-${filterId}`}>
                    <rect width="24" height="24" fill="white"/>
                    <path d="M9 16 L9 20 L15 20 L15 16 Q15 14.5 12 14.5 Q9 14.5 9 16 Z" fill="black"/>
                  </mask>
                </defs>
                {/* Toit triangulaire */}
                <path 
                  d="M12 4 L4 12 L20 12 Z" 
                  fill={color}
                  filter={`url(#${filterId})`}
                />
                {/* Base rectangulaire avec ouverture */}
                <rect 
                  x="4" 
                  y="12" 
                  width="16" 
                  height="8" 
                  rx="1"
                  fill={color}
                  filter={`url(#${filterId})`}
                  mask={`url(#homeMask-${filterId})`}
                />
              </>
            ) : (
              // Outlined version for inactive state - style minimaliste noir
              <>
                <defs>
                  <mask id="homeMask-inactive">
                    <rect width="24" height="24" fill="white"/>
                    <path d="M9 16 L9 20 L15 20 L15 16 Q15 14.5 12 14.5 Q9 14.5 9 16 Z" fill="black"/>
                  </mask>
                </defs>
                {/* Toit triangulaire */}
                <path 
                  d="M12 4 L4 12 L20 12 Z" 
                  fill={color}
                />
                {/* Base rectangulaire avec ouverture */}
                <rect 
                  x="4" 
                  y="12" 
                  width="16" 
                  height="8" 
                  rx="1"
                  fill={color}
                  mask="url(#homeMask-inactive)"
                />
              </>
            )}
          </svg>
        );
      case 'calendar':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {isActive && filterId ? (
              // Filled/glowing version for active state
              <>
                <defs>
                  <filter id={`calFilter-${filterId}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                {/* Deux petits carrés en haut (tabs/anneaux) */}
                <rect x="6" y="3" width="2.5" height="2.5" rx="0.3" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="15.5" y="3" width="2.5" height="2.5" rx="0.3" fill={color} filter={`url(#calFilter-${filterId})`} />
                {/* Rectangle principal du calendrier */}
                <rect 
                  x="4" 
                  y="5" 
                  width="16" 
                  height="15" 
                  rx="1"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  filter={`url(#calFilter-${filterId})`}
                />
                {/* Ligne horizontale séparatrice */}
                <line 
                  x1="4" 
                  y1="8" 
                  x2="20" 
                  y2="8" 
                  stroke={color}
                  strokeWidth="2"
                />
                {/* Carrés représentant les jours - première ligne : 3 à gauche, gap, 4 à droite */}
                <rect x="5.5" y="10" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="8" y="10" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="10.5" y="10" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="14.5" y="10" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="17" y="10" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="19.5" y="10" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                {/* Deuxième ligne : 5 carrés espacés */}
                <rect x="5.5" y="13" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="8" y="13" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="10.5" y="13" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="13" y="13" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="15.5" y="13" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                {/* Troisième ligne : 5 carrés espacés */}
                <rect x="5.5" y="16" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="8" y="16" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="10.5" y="16" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="13" y="16" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
                <rect x="15.5" y="16" width="1.8" height="1.8" fill={color} filter={`url(#calFilter-${filterId})`} />
              </>
            ) : (
              // Outlined version for inactive state - style minimaliste
              <>
                {/* Deux petits carrés en haut (tabs/anneaux) */}
                <rect x="6" y="3" width="2.5" height="2.5" rx="0.3" fill={color} />
                <rect x="15.5" y="3" width="2.5" height="2.5" rx="0.3" fill={color} />
                {/* Rectangle principal du calendrier */}
                <rect 
                  x="4" 
                  y="5" 
                  width="16" 
                  height="15" 
                  rx="1"
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                />
                {/* Ligne horizontale séparatrice */}
                <line 
                  x1="4" 
                  y1="8" 
                  x2="20" 
                  y2="8" 
                  stroke={color}
                  strokeWidth="2"
                />
                {/* Carrés représentant les jours - première ligne : 3 à gauche, gap, 4 à droite */}
                <rect x="5.5" y="10" width="1.8" height="1.8" fill={color} />
                <rect x="8" y="10" width="1.8" height="1.8" fill={color} />
                <rect x="10.5" y="10" width="1.8" height="1.8" fill={color} />
                <rect x="14.5" y="10" width="1.8" height="1.8" fill={color} />
                <rect x="17" y="10" width="1.8" height="1.8" fill={color} />
                <rect x="19.5" y="10" width="1.8" height="1.8" fill={color} />
                {/* Deuxième ligne : 5 carrés espacés */}
                <rect x="5.5" y="13" width="1.8" height="1.8" fill={color} />
                <rect x="8" y="13" width="1.8" height="1.8" fill={color} />
                <rect x="10.5" y="13" width="1.8" height="1.8" fill={color} />
                <rect x="13" y="13" width="1.8" height="1.8" fill={color} />
                <rect x="15.5" y="13" width="1.8" height="1.8" fill={color} />
                {/* Troisième ligne : 5 carrés espacés */}
                <rect x="5.5" y="16" width="1.8" height="1.8" fill={color} />
                <rect x="8" y="16" width="1.8" height="1.8" fill={color} />
                <rect x="10.5" y="16" width="1.8" height="1.8" fill={color} />
                <rect x="13" y="16" width="1.8" height="1.8" fill={color} />
                <rect x="15.5" y="16" width="1.8" height="1.8" fill={color} />
              </>
            )}
          </svg>
        );
      case 'profile':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {isActive && filterId ? (
              // Filled/glowing version for active state
              <>
                <defs>
                  <filter id={`profileFilter-${filterId}`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                {/* Tête - cercle */}
                <circle 
                  cx="12" 
                  cy="9" 
                  r="3.5" 
                  fill={color}
                  filter={`url(#profileFilter-${filterId})`}
                />
                {/* Corps - forme U */}
                <path 
                  d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" 
                  fill={color}
                  filter={`url(#profileFilter-${filterId})`}
                />
              </>
            ) : (
              // Outlined version for inactive state - style minimaliste
              <>
                {/* Tête - cercle */}
                <circle 
                  cx="12" 
                  cy="9" 
                  r="3.5" 
                  fill={color}
                />
                {/* Corps - forme U */}
                <path 
                  d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" 
                  fill={color}
                />
              </>
            )}
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '375px',
      background: 'rgba(10, 15, 26, 0.95)',
      backdropFilter: 'blur(30px)',
      WebkitBackdropFilter: 'blur(30px)',
      borderTop: '0.5px solid rgba(0, 234, 255, 0.2)',
      borderTopLeftRadius: '20px',
      borderTopRightRadius: '20px',
      padding: '8px 12px 12px 12px',
      paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      zIndex: 10000,
      boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(0, 234, 255, 0.1)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <nav style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: '100%',
        gap: '20px',
      }}>
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const filterId = `${tab.icon}Glow-${index}`;
          return (
            <button
              key={tab.id}
              onClick={(e) => {
                // Animation de clic sur l'icône
                const iconDiv = e.currentTarget.querySelector('div');
                if (iconDiv) {
                  iconDiv.style.transform = 'scale(0.92)';
                  setTimeout(() => {
                    iconDiv.style.transform = isActive ? 'scale(1.05)' : 'scale(1)';
                  }, 120);
                }
                // Navigation - IMPORTANT: doit être appelé
                onNavigate(tab.id as 'Home' | 'Schedule' | 'Profile');
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '0',
                minWidth: 'auto',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                color: isActive ? '#00EAFF' : '#9CA3AF',
                transform: isActive ? 'scale(1)' : 'scale(1)',
                boxShadow: 'none',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#D1D5DB';
                  const iconDiv = e.currentTarget.querySelector('div');
                  if (iconDiv) {
                    iconDiv.style.background = 'rgba(255, 255, 255, 0.04)';
                    iconDiv.style.transform = 'scale(1.05)';
                  }
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = '#9CA3AF';
                  const iconDiv = e.currentTarget.querySelector('div');
                  if (iconDiv) {
                    iconDiv.style.background = 'transparent';
                    iconDiv.style.transform = 'scale(1)';
                  }
                }
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '0',
                background: 'transparent',
                filter: isActive ? 'drop-shadow(0 0 6px rgba(0, 234, 255, 0.4))' : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isActive ? 'scale(1.05)' : 'scale(1)'
              }}>
                {getIcon(tab.icon, isActive, filterId)}
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? '#00EAFF' : '#9CA3AF',
                letterSpacing: '0.1px',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
                textShadow: isActive ? '0 0 4px rgba(0, 234, 255, 0.3)' : 'none',
                transition: 'all 0.3s ease',
                marginTop: '2px',
                whiteSpace: 'nowrap'
              }}>
                {tab.label}
              </span>
              {isActive && (
                <div style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  height: '2px',
                  width: '22px',
                  background: '#00EAFF',
                  borderRadius: '1px',
                  boxShadow: '0 0 6px rgba(0, 234, 255, 0.5)'
                }} />
              )}
            </button>
          );
        })}
      </nav>
      <style>{`
        @keyframes glow {
          from { opacity: 0.6; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
