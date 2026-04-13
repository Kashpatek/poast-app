import React from "react";
import { registerRoot, Composition } from "remotion";
import { SAVideo } from "./SAVideo";

const Root: React.FC = () => {
  return (
    <Composition
      id="SAVideo"
      component={SAVideo}
      durationInFrames={1800}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        hook: "",
        scriptSections: [],
        dataPoints: [],
        thumbnailHeadline: "",
        audioUrl: "",
        clipUrls: [],
        musicUrl: "",
        duration: 60,
      }}
    />
  );
};

registerRoot(Root);
