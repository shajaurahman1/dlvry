import { useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import {
  ArrowDown,
  ArrowUp,
  Footprints,
  PackageCheck,
  Pause,
  Play,
  Wallet,
  PhoneCall,
  Store,
  MapPin,
  Globe,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const stories = [
  {
    label: "01 / The order",
    title: "It starts with a phone call.",
    body: "The customer calls their local shop. The shop takes the order and creates a pickup request.",
    icon: PhoneCall,
    kind: "step",
  },
  {
    label: "A little working cash",
    title: "₹500 in hand. ₹200 earned in an hour.",
    body: "I used my cash to pay the shop, collected payment at the doorstep, and kept the delivery fees.",
    icon: Wallet,
    kind: "story",
  },
  {
    label: "02 / The pickup",
    title: "A nearby partner takes it from here.",
    body: "An available delivery partner within the selected radius accepts the request, pays the shop, and picks up the order.",
    icon: Store,
    kind: "step",
  },
  {
    label: "Every step counts",
    title: "10,000 steps. ₹500 towards my goal.",
    body: "I completed my steps and made ₹500. If I keep going, I can save for my protein powder.",
    icon: Footprints,
    kind: "story",
  },
  {
    label: "03 / The doorstep",
    title: "Delivered. Paid. Done.",
    body: "The partner delivers to the customer and collects the order amount plus the delivery fee. Payments stay between them.",
    icon: MapPin,
    kind: "step",
  },
  {
    label: "Around the neighbourhood",
    title: "One more delivery. One step closer.",
    body: "A few local pickups fit around my day. Every delivery fee adds a little more to my savings.",
    icon: PackageCheck,
    kind: "story",
  },
  {
    label: "Work from anywhere",
    title: "Your city finds you, wherever you are.",
    body: "MOVEBY runs on your phone's location. Open the app anywhere in the world and nearby requests come to you.",
    icon: Globe,
    kind: "story",
  },
  {
    label: "No boss. No stress.",
    title: "Freedom at its peak.",
    body: "Go online when you want, pick the orders you like, log off whenever you feel like it. You work only if you want to.",
    icon: Sun,
    kind: "story",
  },
];

export function StoryWheel() {
  const autoScroll = useMemo(
    () =>
      AutoScroll({
        speed: 0.45,
        startDelay: 1800,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        stopOnFocusIn: true,
      }),
    [],
  );
  const [wheelRef, api] = useEmblaCarousel(
    { axis: "y", loop: true, dragFree: true, align: "center" },
    [autoScroll],
  );
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!api) return;
    const update = () => setSelected(api.selectedScrollSnap());
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      if (reduced.matches || document.hidden) autoScroll.stop();
      else if (!paused) autoScroll.play();
    };
    update();
    syncMotion();
    api.on("select", update);
    reduced.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncMotion);
    return () => {
      api.off("select", update);
      reduced.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncMotion);
    };
  }, [api, autoScroll, paused]);

  const move = (direction: "up" | "down") => {
    autoScroll.stop();
    setPaused(true);
    if (direction === "up") api?.scrollPrev();
    else api?.scrollNext();
  };

  return (
    <section
      className="story-section border-y border-border py-12 md:py-16"
      aria-labelledby="story-title"
    >
      <div className="grid items-center gap-5 md:grid-cols-2 md:gap-14">
        <div>
          <p className="text-sm font-semibold text-primary">THE MOVEBY LOOP</p>
          <h2 id="story-title" className="mt-4 text-3xl font-black leading-tight md:text-4xl">
            Local deliveries.
            <br />
            <span className="font-serif-italic font-normal text-primary">
              Personal possibilities.
            </span>
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            A customer calls. A shop gets an order. A nearby partner makes the delivery.
          </p>
          <div className="mt-6 flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous story"
              title="Previous story"
              onClick={() => move("up")}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={paused ? "Play stories" : "Pause stories"}
              title={paused ? "Play stories" : "Pause stories"}
              onClick={() => {
                if (paused) autoScroll.play();
                else autoScroll.stop();
                setPaused(!paused);
              }}
            >
              {paused ? <Play /> : <Pause />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next story"
              title="Next story"
              onClick={() => move("down")}
            >
              <ArrowDown />
            </Button>
            <span className="ml-3 text-xs tabular-nums text-muted-foreground">
              {String(selected + 1).padStart(2, "0")} / {String(stories.length).padStart(2, "0")}
            </span>
          </div>
          <p className="mt-6 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Illustrative stories, not verified reviews. Earnings vary with orders, delivery fees,
            time and expenses.
          </p>
        </div>
        <div
          className="story-wheel"
          ref={wheelRef}
          role="region"
          aria-label="MOVEBY delivery steps and illustrative stories"
          aria-roledescription="carousel"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              move(event.key === "ArrowUp" ? "up" : "down");
            }
          }}
        >
          <div className="story-track">
            {stories.map((story, index) => (
              <div
                key={story.label}
                className="story-slide"
                role="group"
                aria-label={`${index + 1} of ${stories.length}`}
                aria-roledescription="slide"
              >
                <article
                  className={`story-card ${story.kind === "story" ? "story-card-personal" : ""}`}
                >
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-primary">
                    <story.icon className="h-4 w-4 shrink-0" />
                    <span>{story.label}</span>
                  </div>
                  <h3 className="text-xl font-bold leading-tight">{story.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{story.body}</p>
                </article>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
