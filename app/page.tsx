import Image from "next/image";

export default function Home() {
  return (
    <main className="w-dvw h-dvh flex flex-col items-center justify-center overflow-hidden">
      <div className="relative w-[393px] h-[852px] bg-white">
        <Image
          className="absolute inset-[0_0_auto_0]"
          src="/dynamic-island.png"
          alt="Logo"
          width={600}
          height={600}
        />
      </div>
    </main>
  );
}
