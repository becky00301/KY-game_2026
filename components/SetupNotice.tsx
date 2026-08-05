"use client";

/**
 * 프로덕션인데 Supabase 자격증명이 없을 때 뜨는 화면.
 * 이 상태로 게임을 열어 주면 접속자마다 다른 칼을 보게 되므로, 아예 막는다.
 */
export default function SetupNotice() {
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <p className="setup-kicker">설정이 필요합니다</p>
        <h1 className="setup-title">공유 서버가 연결되지 않았어요</h1>
        <p className="setup-body">
          모두가 하나의 칼을 두드리려면 Supabase 연결이 필요합니다. 지금 상태로 열면
          접속하는 사람마다 서로 다른 칼을 보게 되기 때문에 게임을 시작하지 않았습니다.
        </p>
        <ol className="setup-steps">
          <li>
            Supabase 프로젝트에서 <code>supabase/schema.sql</code> 실행
          </li>
          <li>
            배포 환경에 <code>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 등록
          </li>
          <li>다시 배포</li>
        </ol>
        <p className="setup-foot">
          Vercel에서는 Settings → Environment Variables 에 넣은 뒤 재배포해야 값이 반영됩니다.
        </p>
      </div>
    </div>
  );
}
