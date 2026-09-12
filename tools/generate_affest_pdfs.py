from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Flowable,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
PUBLIC = ROOT / "apps" / "web" / "public"
BG = colors.HexColor("#0d1012")
SURFACE = colors.HexColor("#151a1d")
SURFACE_2 = colors.HexColor("#1c2326")
LINE = colors.HexColor("#2b3438")
PAPER = colors.HexColor("#f1efe7")
MUTED = colors.HexColor("#a2acab")
MUTED_2 = colors.HexColor("#738082")
LIME = colors.HexColor("#d6f26a")
BLUE = colors.HexColor("#8b9bff")
AMBER = colors.HexColor("#f5b96a")
GREEN = colors.HexColor("#8fef9a")


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverKicker", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=LIME, tracking=1.5, spaceAfter=12))
styles.add(ParagraphStyle(name="CoverTitle", fontName="Helvetica-Bold", fontSize=39, leading=42, textColor=PAPER, spaceAfter=14))
styles.add(ParagraphStyle(name="CoverSub", fontName="Helvetica", fontSize=15, leading=22, textColor=MUTED, spaceAfter=26))
styles.add(ParagraphStyle(name="H1A", fontName="Helvetica-Bold", fontSize=23, leading=28, textColor=PAPER, spaceBefore=4, spaceAfter=12))
styles.add(ParagraphStyle(name="H2A", fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=PAPER, spaceBefore=10, spaceAfter=7))
styles.add(ParagraphStyle(name="BodyA", fontName="Helvetica", fontSize=10.2, leading=15, textColor=MUTED, spaceAfter=8))
styles.add(ParagraphStyle(name="BodyStrong", fontName="Helvetica-Bold", fontSize=10.2, leading=15, textColor=PAPER, spaceAfter=6))
styles.add(ParagraphStyle(name="SmallA", fontName="Helvetica", fontSize=8.3, leading=11, textColor=MUTED_2, spaceAfter=5))
styles.add(ParagraphStyle(name="LabelA", fontName="Helvetica-Bold", fontSize=8.2, leading=10, textColor=LIME, tracking=1.2, spaceAfter=4))
styles.add(ParagraphStyle(name="QuoteA", fontName="Helvetica-Bold", fontSize=17, leading=23, textColor=PAPER, leftIndent=12, borderColor=LIME, borderWidth=2, borderPadding=10, spaceBefore=6, spaceAfter=18))
styles.add(ParagraphStyle(name="CellA", fontName="Helvetica", fontSize=8.7, leading=12, textColor=MUTED))
styles.add(ParagraphStyle(name="CellStrong", fontName="Helvetica-Bold", fontSize=8.7, leading=12, textColor=PAPER))
styles.add(ParagraphStyle(name="CellAccent", fontName="Helvetica-Bold", fontSize=8.7, leading=12, textColor=LIME))
styles.add(ParagraphStyle(name="FooterA", fontName="Helvetica", fontSize=7.5, leading=9, textColor=MUTED_2))
styles.add(ParagraphStyle(name="LightH1", fontName="Helvetica-Bold", fontSize=22, leading=25, textColor=colors.HexColor("#142017"), spaceAfter=7))
styles.add(ParagraphStyle(name="LightH2", fontName="Helvetica-Bold", fontSize=11.5, leading=14, textColor=colors.HexColor("#142017"), spaceBefore=6, spaceAfter=4))
styles.add(ParagraphStyle(name="LightBody", fontName="Helvetica", fontSize=9.2, leading=12.5, textColor=colors.HexColor("#4c5b52"), spaceAfter=5))
styles.add(ParagraphStyle(name="LightStrong", fontName="Helvetica-Bold", fontSize=9.2, leading=12.5, textColor=colors.HexColor("#142017"), spaceAfter=4))
styles.add(ParagraphStyle(name="LightSmall", fontName="Helvetica", fontSize=7.4, leading=9.5, textColor=colors.HexColor("#68776d"), spaceAfter=3))
styles.add(ParagraphStyle(name="LightLabel", fontName="Helvetica-Bold", fontSize=7.4, leading=9, textColor=colors.HexColor("#6a8a18"), tracking=1.1, spaceAfter=3))
styles.add(ParagraphStyle(name="LightCell", fontName="Helvetica", fontSize=7.6, leading=10, textColor=colors.HexColor("#4c5b52")))
styles.add(ParagraphStyle(name="LightCellStrong", fontName="Helvetica-Bold", fontSize=7.6, leading=10, textColor=colors.HexColor("#142017")))
styles.add(ParagraphStyle(name="LightCellAccent", fontName="Helvetica-Bold", fontSize=7.6, leading=10, textColor=colors.HexColor("#55740d")))


def P(text, style="BodyA"):
    return Paragraph(text, styles[style])


def LP(text, style="LightBody"):
    return Paragraph(text, styles[style])


class AffestMark(Flowable):
    def __init__(self, size=25, label=True):
        super().__init__()
        self.size = size
        self.label = label
        self.width = size + (59 if label else 0)
        self.height = size

    def draw(self):
        c = self.canv
        s = self.size
        c.saveState()
        c.setStrokeColor(colors.HexColor("#6f9716"))
        c.setLineWidth(1.8)
        c.rect(1, 1, s - 2, s - 2, fill=0, stroke=1)
        c.setFillColor(colors.HexColor("#b6d84a"))
        c.circle(s / 2, s / 2, 3.1, fill=1, stroke=0)
        c.restoreState()
        if self.label:
            c.setFillColor(colors.HexColor("#142017"))
            c.setFont("Helvetica-Bold", 16)
            c.drawString(s + 9, 5, "Affest")


class LightDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(str(filename), pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=13 * mm, bottomMargin=13 * mm, title="Affest Attestcoin Integration Summary")
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="light")
        self.addPageTemplates([PageTemplate(id="light", frames=frame, onPage=self.draw_page)])

    def draw_page(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(colors.white)
        canvas.rect(0, 0, self.pagesize[0], self.pagesize[1], fill=1, stroke=0)
        canvas.setStrokeColor(colors.HexColor("#dce5d5"))
        canvas.setLineWidth(0.6)
        canvas.line(self.leftMargin, 9 * mm, self.pagesize[0] - self.rightMargin, 9 * mm)
        canvas.setFillColor(colors.HexColor("#77857a"))
        canvas.setFont("Helvetica", 7)
        canvas.drawString(self.leftMargin, 5 * mm, "AFFEST  /  ATTESTCOIN PROTOCOL INTEGRATION")
        canvas.drawRightString(self.pagesize[0] - self.rightMargin, 5 * mm, "BUIDL CTC 2026 FALL")
        canvas.restoreState()


def logo(size=20):
    # A compact Affest mark rendered as a table: diamond, center point, wordmark.
    mark = Table([[P("+", "CellAccent")]], colWidths=[size], rowHeights=[size])
    mark.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), BG), ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOX", (0, 0), (-1, -1), 0.7, LIME)]))
    word = P("<b>Affest</b>", "BodyStrong")
    row = Table([[mark, word]], colWidths=[size + 8, 80], rowHeights=[size])
    row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    return row


def panel(title, body, accent=LIME, width=170 * mm):
    t = Table([[P(title, "CellAccent")], [P(body, "CellA")]], colWidths=[width])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LINEBEFORE", (0, 0), (0, -1), 2.4, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def pipeline(items, width=170 * mm):
    cells = []
    for index, (name, detail, accent) in enumerate(items):
        cells.append([P(f"{index + 1:02d}", "CellAccent"), P(f"<b>{name}</b><br/>{detail}", "CellA")])
    table = Table([cells], colWidths=[width / len(cells)] * len(cells))
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return table


class DarkDoc(BaseDocTemplate):
    def __init__(self, filename, pagesize=A4):
        super().__init__(str(filename), pagesize=pagesize, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=17 * mm, title="Affest")
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="normal")
        self.addPageTemplates([PageTemplate(id="dark", frames=frame, onPage=self.draw_page)])

    def draw_page(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BG)
        canvas.rect(0, 0, self.pagesize[0], self.pagesize[1], fill=1, stroke=0)
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.5)
        canvas.line(self.leftMargin, 12 * mm, self.pagesize[0] - self.rightMargin, 12 * mm)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(MUTED_2)
        canvas.drawString(self.leftMargin, 7 * mm, "AFFEST  /  VERIFIED CROSS-CHAIN AUTOMATION")
        canvas.drawRightString(self.pagesize[0] - self.rightMargin, 7 * mm, f"{doc.page:02d}")
        canvas.restoreState()


def cover(story, eyebrow, title, subtitle, label):
    story.append(Spacer(1, 23 * mm))
    story.append(logo())
    story.append(Spacer(1, 26 * mm))
    story.append(P(eyebrow.upper(), "CoverKicker"))
    story.append(P(title, "CoverTitle"))
    story.append(P(subtitle, "CoverSub"))
    story.append(panel("THE ONE-LINE IDEA", label, LIME, 145 * mm))
    story.append(Spacer(1, 34 * mm))
    story.append(P("BUIDL CTC 2026 Fall  /  Testnet submission material", "SmallA"))


def build_summary(path):
    doc = DarkDoc(path)
    story = []
    cover(
        story,
        "Attestcoin Protocol Integration",
        "Affest + Attestcoin",
        "A simple explanation of how Affest turns activity on Ethereum into a verified, policy-controlled action on Creditcoin.",
        "Affest never trusts a backend claim that an Ethereum event happened. Creditcoin verifies the Attestcoin proof before any portfolio action is allowed.",
    )
    story.append(PageBreak())
    story.append(P("What Attestcoin does for Affest", "H1A"))
    story.append(P("Affest is an agent-first portfolio dashboard. An AI agent can monitor a strategy and prepare a rebalance, but it cannot turn an unverified message into permission to move funds. Attestcoin is the bridge between the source-chain fact and the destination-chain rule.", "BodyA"))
    story.append(P("In plain English", "H2A"))
    story.append(P("A user creates a signal on Ethereum Sepolia. Attestcoin produces a cryptographic proof that the transaction is included in an attested Ethereum block. Affest sends that proof to Creditcoin. The Affest verifier checks the proof, the receipt, and the exact event. Only then can the strategy manager allow a rebalance.", "QuoteA"))
    story.append(P("The real flow", "H2A"))
    story.append(pipeline([
        ("Ethereum Sepolia", "PortfolioSignal event", LIME),
        ("Attestcoin", "attestation + proof", BLUE),
        ("Creditcoin", "proof verification", AMBER),
        ("Affest policy", "limits are checked", LIME),
        ("Vault action", "approved or automatic", GREEN),
    ]))
    story.append(Spacer(1, 14))
    story.append(P("What is verified", "H2A"))
    checks = [
        [P("CHECK", "CellAccent"), P("WHY IT MATTERS", "CellAccent")],
        [P("Source-chain key", "CellStrong"), P("The proof must identify the configured Ethereum Sepolia chain.", "CellA")],
        [P("Receipt status", "CellStrong"), P("Proof inclusion alone is not enough. The source transaction must have succeeded.", "CellA")],
        [P("Emitter contract", "CellStrong"), P("The event must come from Affest's configured PortfolioSignalEmitter.", "CellA")],
        [P("Event and fields", "CellStrong"), P("Signature, user, asset, signal type, amount, and log index must match the strategy.", "CellA")],
        [P("Replay key", "CellStrong"), P("A verified source log can only be consumed once.", "CellA")],
    ]
    table = Table(checks, colWidths=[43 * mm, 117 * mm])
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), SURFACE_2), ("BACKGROUND", (0, 1), (-1, -1), SURFACE), ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.append(table)
    story.append(PageBreak())
    story.append(P("Where the logic lives", "H1A"))
    story.append(P("The database and worker coordinate the experience. They do not grant permission. Permission is enforced by Creditcoin contracts.", "BodyA"))
    story.append(panel("1. SOURCE EVENT", "PortfolioSignalEmitter emits a structured event with a unique signalId, the user, an asset, an amount, and signalType.", LIME))
    story.append(Spacer(1, 8))
    story.append(panel("2. PROOF BUILDER", "The worker waits for the source block to be attested, then uses the official @gluwa/usc-sdk proof builder. The response is validated at the TypeScript boundary.", BLUE))
    story.append(Spacer(1, 8))
    story.append(panel("3. CREDITCOIN VERIFIER", "AffestAttestationVerifier calls the official BlockProver/native query verifier, decodes the proven transaction, and checks receipt success and application-level event conditions.", AMBER))
    story.append(Spacer(1, 8))
    story.append(panel("4. POLICY AND VAULT", "AffestExecutor and AffestStrategyManager enforce owner, asset, adapter, amount, allocation, expiry, cooldown, pause, and replay rules before the vault can act.", GREEN))
    story.append(Spacer(1, 14))
    story.append(P("Verified testnet addresses", "H2A"))
    address_rows = [
        [P("Component", "CellAccent"), P("Address", "CellAccent")],
        [P("Source signal emitter", "CellStrong"), P("0x5b185D...e73C2b6", "CellA")],
        [P("Attestation verifier", "CellStrong"), P("0xD5ed47...9861D1D", "CellA")],
        [P("Strategy manager", "CellStrong"), P("0xf016A4...779020B", "CellA")],
        [P("Executor", "CellStrong"), P("0x254461...44cA883", "CellA")],
    ]
    at = Table(address_rows, colWidths=[55 * mm, 105 * mm])
    at.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), SURFACE_2), ("BACKGROUND", (0, 1), (-1, -1), SURFACE), ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.append(at)
    story.append(Spacer(1, 12))
    story.append(P("Current boundary", "H2A"))
    story.append(P("Affest's Attestcoin verification path is real and contract-enforced. The CC3 swap adapter is a labelled demo adapter while reliable, documented CC3 DEX liquidity is unavailable. The demo never presents that adapter as a production exchange.", "BodyA"))
    story.append(P("Judge takeaway: the AI can suggest and coordinate, but it cannot manufacture the cross-chain fact or bypass the user's on-chain limits.", "BodyStrong"))
    doc.build(story)


def build_summary(path):
    """One-page, white-background judge handout using the production logo mark."""
    doc = LightDoc(path)
    story = [
        AffestMark(25),
        Spacer(1, 7),
        LP("ATTESTCOIN PROTOCOL INTEGRATION", "LightLabel"),
        LP("Affest verifies the fact before a portfolio can act.", "LightH1"),
        LP("Affest lets an AI agent help manage a portfolio without giving that agent unlimited control. When something happens on Ethereum, Affest asks Attestcoin for cryptographic proof. Creditcoin checks the proof before any strategy action is allowed.", "LightBody"),
        Spacer(1, 5),
    ]

    flow = [
        [LP("01", "LightCellAccent"), LP("<b>Ethereum Sepolia</b><br/>A user creates a PortfolioSignal event.", "LightCell")],
        [LP("02", "LightCellAccent"), LP("<b>Attestcoin</b><br/>The source transaction is included in an attested block and a proof is built.", "LightCell")],
        [LP("03", "LightCellAccent"), LP("<b>Creditcoin CC3</b><br/>Affest verifies the proof, receipt, event, user, asset, amount, and signal type.", "LightCell")],
        [LP("04", "LightCellAccent"), LP("<b>On-chain policy</b><br/>Limits, allocation, expiry, pause, and replay rules are checked.", "LightCell")],
        [LP("05", "LightCellAccent"), LP("<b>Portfolio action</b><br/>The action is approved by the user or executed within the policy.", "LightCell")],
    ]
    flow_table = Table(flow, colWidths=[12 * mm, 158 * mm], rowHeights=[20 * mm] * 5)
    flow_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f5f8f2")),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#dce5d5")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e9df")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [LP("THE VERIFIED FLOW", "LightLabel"), flow_table, Spacer(1, 8)]

    left = [
        LP("WHAT ATTESTCOIN PROVES", "LightLabel"),
        LP("Attestcoin proves that the Ethereum transaction is included in an attested source-chain block. It gives Affest evidence that can be checked on Creditcoin.", "LightBody"),
        LP("WHAT AFFEST CHECKS AFTER PROOF", "LightLabel"),
        LP("Affest still checks that the receipt succeeded, the event came from the right contract, the event fields match the strategy, and the source event has not been used before.", "LightBody"),
    ]
    right = [
        LP("WHY THIS MATTERS", "LightLabel"),
        LP("A worker, database, or AI model can report an observation. None of them can grant permission. The Creditcoin contracts make the final decision.", "LightBody"),
        LP("SIMPLE SECURITY PROMISE", "LightLabel"),
        LP("The agent can read, explain, plan, and request. It cannot access private keys, send arbitrary calldata, or bypass the user's limits.", "LightBody"),
    ]
    columns = Table([[left, right]], colWidths=[82 * mm, 82 * mm])
    columns.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 11),
        ("LEFTPADDING", (1, 0), (1, -1), 11),
        ("RIGHTPADDING", (1, 0), (1, -1), 0),
        ("LINEBEFORE", (1, 0), (1, -1), 0.6, colors.HexColor("#dce5d5")),
    ]))
    story += [columns, Spacer(1, 6)]
    story.append(panel_light("JUDGE TAKEAWAY", "An AI portfolio manager can react to a verified event on another blockchain without trusting our backend and without receiving unrestricted access to the user's funds."))
    story += [Spacer(1, 6), LP("Testnet only. Attestcoin verification is real and contract-enforced. The CC3 swap adapter is a labelled demo adapter while a reliable documented CC3 DEX route is unavailable.", "LightSmall")]
    doc.build(story)


def panel_light(title, body):
    t = Table([[LP(title, "LightLabel")], [LP(body, "LightStrong")]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#edf7d7")),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#c7dc91")),
        ("LEFTPADDING", (0, 0), (-1, -1), 11),
        ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def build_whitepaper(path):
    doc = DarkDoc(path)
    story = []
    cover(
        story,
        "Project deck / whitepaper",
        "Affest",
        "Verified cross-chain automation for self-driving portfolios.",
        "Create and control an automated portfolio from a dashboard. Manage it from any AI agent through MCP, while Creditcoin enforces the user's boundaries.",
    )
    story.append(PageBreak())
    story.append(P("01  The problem", "H1A"))
    story.append(P("AI agents can read more systems than people can monitor, but financial automation has a trust problem. A backend can say that an event happened. A model can misread a message. A compromised relayer can try to overreach. None of those claims should become a withdrawal permission.", "BodyA"))
    story.append(P("Affest separates observation from authority. Agents may read, explain, plan, and request. The chain decides whether a verified source fact satisfies a user-approved policy.", "QuoteA"))
    story.append(P("The user story", "H2A"))
    story.append(panel("A HUMAN RULE", "Keep 70% of my portfolio in stable assets and 30% in risk assets. When I receive at least 1,000 USDC on Ethereum, prepare a rebalance. Automatically execute it below my $500 limit; otherwise ask me.", LIME))
    story.append(Spacer(1, 14))
    story.append(P("02  The product", "H1A"))
    features = [
        [P("SURFACE", "CellAccent"), P("WHAT IT DOES", "CellAccent"), P("USER VALUE", "CellAccent")],
        [P("Investor dashboard", "CellStrong"), P("Create vaults, inspect allocations, review deterministic strategy rules, approve actions, and pause access.", "CellA"), P("Human control stays visible.", "CellA")],
        [P("Remote MCP", "CellStrong"), P("Expose read, planning, proof, and action tools through a model-independent Streamable HTTP server.", "CellA"), P("Use Claude, GPT, or another MCP client.", "CellA")],
        [P("Proof worker", "CellStrong"), P("Monitor Sepolia, wait for Attestcoin, build proofs, simulate, and coordinate Creditcoin submission.", "CellA"), P("Automation can run without trusting the worker.", "CellA")],
        [P("Creditcoin contracts", "CellStrong"), P("Enforce assets, adapters, limits, expiry, replay protection, pause state, and execution mode.", "CellA"), P("Policy is on-chain, not a database promise.", "CellA")],
    ]
    ft = Table(features, colWidths=[35 * mm, 82 * mm, 43 * mm])
    ft.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), SURFACE_2), ("BACKGROUND", (0, 1), (-1, -1), SURFACE), ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.append(ft)
    story.append(PageBreak())
    story.append(P("03  How the trust model works", "H1A"))
    story.append(P("Affest uses a simple rule: data may be observed off-chain, but permission must be decided on-chain.", "BodyA"))
    story.append(pipeline([
        ("Observe", "worker sees a source log", LIME),
        ("Attest", "Attestcoin proves inclusion", BLUE),
        ("Decode", "receipt and event are checked", AMBER),
        ("Authorize", "strategy limits are checked", LIME),
        ("Act", "vault executes an allowlisted action", GREEN),
    ]))
    story.append(Spacer(1, 16))
    story.append(P("Three execution modes", "H2A"))
    modes = [
        [P("MODE", "CellAccent"), P("BEHAVIOUR", "CellAccent")],
        [P("Approval", "CellStrong"), P("The agent prepares an unsigned action. The user reviews and signs it.", "CellA")],
        [P("Automatic", "CellStrong"), P("A restricted executor acts only when the on-chain policy allows the exact proof-backed request.", "CellA")],
        [P("Hybrid", "CellStrong"), P("Small actions execute automatically. Larger actions become approval requests. This is Affest's recommended mode.", "CellA")],
    ]
    mt = Table(modes, colWidths=[35 * mm, 125 * mm])
    mt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), SURFACE_2), ("BACKGROUND", (0, 1), (-1, -1), SURFACE), ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.append(mt)
    story.append(PageBreak())
    story.append(P("04  Attestcoin integration", "H1A"))
    story.append(P("Affest uses Attestcoin as a proof layer for Ethereum activity. It does not treat a log index, database row, or AI response as proof.", "BodyA"))
    story.append(panel("SOURCE", "Ethereum Sepolia hosts PortfolioSignalEmitter. Its emitSignal function emits a unique PortfolioSignal event with signalId, user, asset, amount, and signalType.", LIME))
    story.append(Spacer(1, 8))
    story.append(panel("PROOF", "The worker waits for the source block to reach the Attestcoin attested height, then uses the official USC SDK to build the proof from the transaction hash.", BLUE))
    story.append(Spacer(1, 8))
    story.append(panel("VERIFICATION", "On Creditcoin, AffestAttestationVerifier invokes the official native query verifier and decoder. It requires successful receipt status, the right source contract, exact event signature, matching fields, and an unused event key.", AMBER))
    story.append(Spacer(1, 8))
    story.append(panel("ACTION", "Only after verification does AffestExecutor call the strategy manager and vault. The adapter and assets are allowlisted, and the request is bounded by the user's policy.", GREEN))
    story.append(Spacer(1, 14))
    story.append(P("Why Attestcoin is necessary", "H2A"))
    story.append(P("Without Attestcoin, Affest would be trusting its own worker to report what happened on Ethereum. With Attestcoin, the worker supplies evidence and Creditcoin verifies the evidence before the policy can run. The worker coordinates; the contract judges.", "QuoteA"))
    story.append(PageBreak())
    story.append(P("05  MCP for agent-first finance", "H1A"))
    story.append(P("The MCP server is model-independent. Any compatible client can use the same typed tools, credentials, scopes, and audit trail.", "BodyA"))
    tools = [
        [P("LAYER", "CellAccent"), P("EXAMPLES", "CellAccent"), P("GUARDRAIL", "CellAccent")],
        [P("Read", "CellStrong"), P("get_portfolios, get_strategy, get_pending_actions", "CellA"), P("No signing. No secret material.", "CellA")],
        [P("Plan", "CellStrong"), P("draft_strategy, validate_strategy, preview_rebalance", "CellA"), P("Deterministic schema before permission.", "CellA")],
        [P("Proof", "CellStrong"), P("check_attestation_readiness, build_attestcoin_proof", "CellA"), P("Evidence is explicit and inspectable.", "CellA")],
        [P("Action", "CellStrong"), P("request_rebalance, pause_strategy, revoke_agent_access", "CellA"), P("Preview-first, scoped, idempotent, audited.", "CellA")],
    ]
    tt = Table(tools, colWidths=[30 * mm, 82 * mm, 48 * mm])
    tt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), SURFACE_2), ("BACKGROUND", (0, 1), (-1, -1), SURFACE), ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.append(tt)
    story.append(Spacer(1, 14))
    story.append(P("06  Security by design", "H1A"))
    story.append(P("Affest assumes the agent, worker, database, and relayer can fail. The design limits what each layer can do.", "BodyA"))
    security = [
        [P("Threat", "CellAccent"), P("Boundary", "CellAccent")],
        [P("Malicious agent", "CellStrong"), P("Scoped bearer credential, preview-first actions, no arbitrary calldata, instant revoke.", "CellA")],
        [P("Compromised relayer", "CellStrong"), P("Cannot withdraw arbitrarily. Contracts enforce allowlists, limits, expiry, and pause state.", "CellA")],
        [P("Tampered or replayed proof", "CellStrong"), P("Official verifier path, receipt/event checks, and unique source event keys.", "CellA")],
        [P("Database compromise", "CellStrong"), P("Database coordinates UX only. On-chain state remains the permission source.", "CellA")],
        [P("Prompt injection", "CellStrong"), P("Natural language becomes a visible deterministic draft; it never becomes arbitrary execution rights.", "CellA")],
    ]
    st = Table(security, colWidths=[45 * mm, 115 * mm])
    st.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), SURFACE_2), ("BACKGROUND", (0, 1), (-1, -1), SURFACE), ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.append(st)
    story.append(PageBreak())
    story.append(P("07  MVP status and demo", "H1A"))
    story.append(P("The MVP is deliberately small: one vault per user, two portfolio assets, one Sepolia signal type, one deterministic strategy shape, three execution modes, a remote MCP server, and a real Attestcoin verification boundary.", "BodyA"))
    story.append(P("The judge journey", "H2A"))
    story.append(pipeline([
        ("Connect", "Creditcoin wallet", LIME),
        ("Create", "strategy + limits", BLUE),
        ("Attach", "MCP credential", AMBER),
        ("Signal", "Sepolia event", LIME),
        ("Verify", "Attestcoin on CC3", GREEN),
    ]))
    story.append(Spacer(1, 14))
    story.append(panel("WHAT IS REAL", "The dashboard, MCP server, Creditcoin contracts, source event contract, proof schema boundary, replay rules, and verifier integration are implemented. The worker is persistent and restart-safe.", GREEN))
    story.append(Spacer(1, 8))
    story.append(panel("WHAT IS LABELLED", "CC3 exchange execution uses a fixed demo adapter because a reliable documented CC3 DEX route and liquidity guarantee were not confirmed. This boundary is shown in the product and documentation.", AMBER))
    story.append(Spacer(1, 8))
    story.append(panel("WHAT TO REMEMBER", "An AI portfolio manager can react to activity on another blockchain without trusting the backend and without receiving unrestricted access to the user's funds.", LIME))
    story.append(Spacer(1, 18))
    story.append(P("Links", "H2A"))
    story.append(P("Dashboard: <link href='https://affest.cefo.dev' color='#d6f26a'>affest.cefo.dev</link><br/>MCP endpoint: <link href='https://mcp.affest.cefo.dev/mcp' color='#d6f26a'>mcp.affest.cefo.dev/mcp</link><br/>Source contract: <link href='https://sepolia.etherscan.io/address/0x5b185DC5443dca8bda7C4ca7De1a6BcA8d73C2b6' color='#d6f26a'>Sepolia explorer</link>", "BodyA"))
    story.append(P("Testnet only. Never use production funds or credentials in this demo.", "SmallA"))
    doc.build(story)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    summary = OUTPUT / "affest-summary.pdf"
    whitepaper = OUTPUT / "affest-whitepaper.pdf"
    build_summary(summary)
    build_whitepaper(whitepaper)
    (PUBLIC / summary.name).write_bytes(summary.read_bytes())
    (PUBLIC / whitepaper.name).write_bytes(whitepaper.read_bytes())
    print(summary)
    print(whitepaper)
    print(PUBLIC / summary.name)
    print(PUBLIC / whitepaper.name)


if __name__ == "__main__":
    main()
