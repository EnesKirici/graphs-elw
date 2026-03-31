"use client";

/*
  Background Animation - Parlak parçacık sistemi.
  Koyu arka planda görünür olması için:
  - Parçacık opacity artırıldı (0.3-0.8 arası)
  - Boyutlar büyütüldü (1-3px)
  - Çizgi bağlantıları daha parlak
  - Birkaç büyük "yıldız" parçacık eklendi
*/

import { useEffect, useRef } from "react";

export default function BackgroundAnimation() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationId;
    let mouse = { x: -1000, y: -1000 };

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function handleMouse(e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    window.addEventListener("mousemove", handleMouse);

    // Normal parçacıklar
    const particles = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.5 + 0.3,
        r: 80 + Math.floor(Math.random() * 40),
        g: 160 + Math.floor(Math.random() * 60),
        b: 240 + Math.floor(Math.random() * 15),
      });
    }

    // Büyük parlak "yıldız" parçacıklar (az sayıda, dikkat çekici)
    const stars = [];
    for (let i = 0; i < 8; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 2.5,
        speedX: (Math.random() - 0.5) * 0.15,
        speedY: (Math.random() - 0.5) * 0.15,
        baseOpacity: Math.random() * 0.3 + 0.5,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }

    let frame = 0;

    function animate() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Normal parçacıklar ---
      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Mouse etkileşimi
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let boost = 0;
        if (dist < 200) {
          boost = (200 - dist) / 200 * 0.5;
        }

        const finalOpacity = Math.min(p.opacity + boost, 1);

        // Ana nokta
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${finalOpacity})`;
        ctx.fill();

        // Glow
        if (boost > 0.1) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${boost * 0.15})`;
          ctx.fill();
        }
      });

      // --- Parçacıklar arası çizgiler ---
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            const lineOpacity = 0.12 * (1 - dist / 140);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(100, 180, 255, ${lineOpacity})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // --- Büyük yıldız parçacıklar (pulse efektli) ---
      stars.forEach((s) => {
        s.x += s.speedX;
        s.y += s.speedY;
        if (s.x < 0) s.x = canvas.width;
        if (s.x > canvas.width) s.x = 0;
        if (s.y < 0) s.y = canvas.height;
        if (s.y > canvas.height) s.y = 0;

        // Pulse: opacity zamanla artıp azalır
        const pulse = Math.sin(frame * s.pulseSpeed + s.pulseOffset);
        const opacity = s.baseOpacity + pulse * 0.2;

        // Dış glow
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 180, 255, ${opacity * 0.08})`;
        ctx.fill();

        // Orta glow
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(130, 200, 255, ${opacity * 0.15})`;
        ctx.fill();

        // Çekirdek
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 220, 255, ${opacity})`;
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
