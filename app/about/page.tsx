import LeadButton from "@/components/LeadButton";

export const metadata = { title: "团队介绍 · 书童 ShuTong" };

const TEAM = [
  {
    name: "蒋佳良", role: "技术负责人", photo: "/team/jiang-jialiang.jpg",
    bio: "资深机器学习AI工程师，纽约州立大学布法罗分校计算机科学博士。曾任 Airbnb 核心风控与信任安全算法模型负责人，主导反欺诈、反洗钱与账户安全等多条生产级 AI 模型线，具备亿万级用户规模下端到端 AI 系统的搭建与落地经验。创办香港 AI 咨询公司 PIXIE SPIRITS，长期为企业提供 AI 战略与落地服务。",
  },
  {
    name: "叶荣瑞", role: "产品与供应链负责人", photo: "/team/ye-rongrui.jpg",
    bio: "香港海智有限公司董事，长期专注 AI 算力芯片、存储芯片及半导体元器件的跨境贸易与供应链整合；伦敦大学学院无线通信硕士，拥有全球化技术与资源网络。",
  },
  {
    name: "庄文检", role: "项目负责人", photo: "/team/zhuang-wenjian.jpg",
    bio: "上海上格国际贸易、上海前民实业法人兼总经理，拥有十余年化工大宗贸易与实业经营管理经验；擅长产业链资源整合、商务谈判与全链条风险管控。",
  },
  {
    name: "詹有宁", role: "商务与运营负责人", photo: "/team/zhan-youning.jpg",
    bio: "曾任阿里巴巴和蔚来汽车高级运营专家；12 年互联网&智能汽车&AI行业经验，主导用户增长、AI产品体验与商业化落地，多个 0→1 项目拿到结果。",
  },
];

// 关于：团队介绍
export default function About() {
  return (
    <section className="sec">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <h2>团队介绍：行业与技术融合典范</h2>
            <p>Our Team</p>
          </div>
        </div>
        <div className="team-grid">
          {TEAM.map((m) => (
            <article className="team-card" key={m.name}>
              <img className="team-photo" src={m.photo} alt={m.name} width={128} height={128} />
              <span className="team-role">{m.role}</span>
              <h3>{m.name}</h3>
              <p>{m.bio}</p>
            </article>
          ))}
        </div>
        <div className="team-sum">
          <b>总结：</b>团队兼具「AI 技术研发」与「实体产业资源」双重基因 —— 既懂算法，也懂产业、懂落地。
        </div>
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <LeadButton source="团队介绍">与我们聊聊 AI 落地</LeadButton>
        </div>
      </div>
    </section>
  );
}
