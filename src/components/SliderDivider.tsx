import React from 'react';

export const SliderDivider = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '24px 0', gap: 12 }}>
    <svg width='60' height='2' viewBox='0 0 60 2'>
      <defs>
        <linearGradient id='sdg-l' x1='0%' y1='0%' x2='100%' y2='0%'>
          <stop offset='0%' stopColor='#0044FF' stopOpacity={0}/>
          <stop offset='100%' stopColor='#00D4FF' stopOpacity={0.7}/>
        </linearGradient>
      </defs>
      <line x1='0' y1='1' x2='60' y2='1' stroke='url(#sdg-l)' strokeWidth='2' strokeLinecap='round'/>
    </svg>
    <img
      src='/logo/logo_final.png'
      alt=''
      style={{ width: 80, height: 'auto', display: 'block', margin: '4px auto 0', mixBlendMode: 'screen' as any }}
    />
    <svg width='60' height='2' viewBox='0 0 60 2'>
      <defs>
        <linearGradient id='sdg-r' x1='0%' y1='0%' x2='100%' y2='0%'>
          <stop offset='0%' stopColor='#00D4FF' stopOpacity={0.7}/>
          <stop offset='100%' stopColor='#0044FF' stopOpacity={0}/>
        </linearGradient>
      </defs>
      <line x1='0' y1='1' x2='60' y2='1' stroke='url(#sdg-r)' strokeWidth='2' strokeLinecap='round'/>
    </svg>
  </div>
);
