/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // 지금 돌고 있는 화면이 어느 배포인지 알기 위해 빌드 시점의 커밋 해시를 코드에 박아 둔다.
    // 새 배포가 나오면 /api/version이 다른 값을 돌려주고, 화면이 그걸 보고 스스로 새로고침한다.
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
};

export default nextConfig;
