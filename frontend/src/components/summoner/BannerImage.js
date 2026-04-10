"use client";

import { useState, useEffect } from "react";

function centeredSplashUrl(champName, skinNum = 0) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champName}_${skinNum}.jpg`;
}

export default function BannerImage({ champion, skins = [0] }) {
  const champId = champion?.replace(/[^a-zA-Z]/g, "");
  const [skinNum, setSkinNum] = useState(0);

  useEffect(() => {
    if (skins.length > 1) {
      setSkinNum(skins[Math.floor(Math.random() * skins.length)]);
    }
  }, [skins]);

  if (!champId) return null;

  return (
    <img
      src={centeredSplashUrl(champId, skinNum)}
      alt=""
      className="w-full h-full object-cover object-[center_20%]"
      onError={() => {
        if (skinNum !== 0) setSkinNum(0);
      }}
    />
  );
}
