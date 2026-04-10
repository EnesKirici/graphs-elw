"use client";

import { useState, useMemo } from "react";

function centeredSplashUrl(champName, skinNum = 0) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${champName}_${skinNum}.jpg`;
}

export default function BannerImage({ champion, skins = [0] }) {
  const selectedSkin = useMemo(
    () => skins[Math.floor(Math.random() * skins.length)],
    [skins]
  );

  const champId = champion?.replace(/[^a-zA-Z]/g, "");
  const [src, setSrc] = useState(
    champId ? centeredSplashUrl(champId, selectedSkin) : null
  );

  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      className="w-full h-full object-cover object-[center_20%]"
      onError={() => {
        if (selectedSkin !== 0) {
          setSrc(centeredSplashUrl(champId, 0));
        }
      }}
    />
  );
}
