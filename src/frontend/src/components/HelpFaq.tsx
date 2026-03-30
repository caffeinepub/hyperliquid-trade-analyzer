import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, Globe, Settings, Terminal } from "lucide-react";

export default function HelpFaq() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Help & FAQ
          </CardTitle>
          <CardDescription>
            Common questions and troubleshooting for Hyperliquid trading
            simulation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="testnet-prices">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>Why do Testnet prices differ from Mainnet?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Important</AlertTitle>
                  <AlertDescription>
                    Hyperliquid Testnet is{" "}
                    <strong>not suitable for realistic trade simulation</strong>
                    .
                  </AlertDescription>
                </Alert>

                <div className="space-y-3 text-sm">
                  <p className="font-medium">
                    Key differences between Testnet and Mainnet:
                  </p>

                  <div className="space-y-2 pl-4">
                    <div>
                      <strong>Oracle & Price Feeds:</strong>
                      <p className="text-muted-foreground mt-1">
                        Testnet does not use the same oracle system as Mainnet.
                        While Mainnet pulls real-time prices from multiple
                        exchanges (Binance, OKX, Bybit, etc.) and updates every
                        3 seconds, Testnet uses simplified mock oracles or
                        infrequent price feeds.
                      </p>
                    </div>

                    <div>
                      <strong>Liquidity:</strong>
                      <p className="text-muted-foreground mt-1">
                        Testnet has virtually no real liquidity. A few test
                        orders can significantly distort prices, making charts
                        and orderbooks unrealistic.
                      </p>
                    </div>

                    <div>
                      <strong>Price Discovery:</strong>
                      <p className="text-muted-foreground mt-1">
                        Mainnet prices reflect real market supply and demand.
                        Testnet prices are artificial and can deviate by 1-5% or
                        more from actual market prices.
                      </p>
                    </div>

                    <div>
                      <strong>Asset Availability:</strong>
                      <p className="text-muted-foreground mt-1">
                        Many assets available on Mainnet (e.g., Copper/USDC) do
                        not exist on Testnet, or have different configurations.
                      </p>
                    </div>
                  </div>

                  <div className="bg-muted p-3 rounded-md mt-4">
                    <p className="font-medium mb-1">Example:</p>
                    <p className="text-muted-foreground text-sm">
                      If ETH shows $1,966 on Testnet while Mainnet shows $2,000,
                      this is expected behavior. The Testnet price is not
                      connected to real market data.
                    </p>
                  </div>

                  <div className="bg-primary/10 p-3 rounded-md mt-4 border border-primary/20">
                    <p className="font-medium mb-1">Recommendation:</p>
                    <p className="text-sm">
                      For realistic trade simulation with actual Hyperliquid
                      Mainnet prices, use paper trading tools like{" "}
                      <strong>Vibe Trader</strong> (see below).
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="vibetrader-access">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>
                    How to access Vibe Trader when the site won't load?
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="space-y-3 text-sm">
                  <div className="bg-muted p-3 rounded-md">
                    <p className="font-medium mb-1">Official URL:</p>
                    <code className="text-primary">
                      https://vibetrader.vip/
                    </code>
                    <p className="text-muted-foreground text-xs mt-2">
                      ⚠️ Try <strong>without</strong> "www" — many users report
                      that <code>www.vibetrader.vip</code> does not load, but{" "}
                      <code>vibetrader.vip</code> works.
                    </p>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Common Issue</AlertTitle>
                    <AlertDescription>
                      If the site is not loading, it's usually a DNS or network
                      routing problem on your end, not a server issue.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4 mt-4">
                    <div>
                      <h4 className="font-medium mb-2">
                        macOS Troubleshooting Steps:
                      </h4>

                      <div className="space-y-3 pl-4">
                        <div>
                          <p className="font-medium">
                            1. Disable "Limit IP Address Tracking"
                          </p>
                          <p className="text-muted-foreground text-xs mt-1">
                            This is the most common cause on macOS Ventura and
                            later.
                          </p>
                          <ol className="list-decimal list-inside text-muted-foreground text-xs mt-2 space-y-1 pl-2">
                            <li>
                              Open <strong>System Settings</strong>
                            </li>
                            <li>
                              Go to <strong>Network</strong>
                            </li>
                            <li>Select your active Wi-Fi network</li>
                            <li>
                              Click <strong>Details</strong>
                            </li>
                            <li>
                              Turn <strong>OFF</strong> "Limit IP Address
                              Tracking"
                            </li>
                            <li>Disconnect and reconnect Wi-Fi</li>
                          </ol>
                        </div>

                        <div>
                          <p className="font-medium">2. Change DNS Servers</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            Use public DNS servers that reliably resolve .vip
                            domains.
                          </p>
                          <ol className="list-decimal list-inside text-muted-foreground text-xs mt-2 space-y-1 pl-2">
                            <li>
                              Open <strong>System Settings</strong> →{" "}
                              <strong>Network</strong>
                            </li>
                            <li>
                              Select your Wi-Fi → <strong>Details</strong>
                            </li>
                            <li>
                              Go to <strong>DNS</strong> tab
                            </li>
                            <li>
                              Add these DNS servers:
                              <div className="bg-background p-2 rounded mt-1 font-mono text-xs">
                                1.1.1.1
                                <br />
                                8.8.8.8
                              </div>
                            </li>
                            <li>
                              Click <strong>OK</strong> and reconnect Wi-Fi
                            </li>
                          </ol>
                        </div>

                        <div>
                          <p className="font-medium">3. Flush DNS Cache</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            Clear any stale DNS entries.
                          </p>
                          <div className="bg-background p-3 rounded-md mt-2 border">
                            <div className="flex items-start gap-2">
                              <Terminal className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground mb-2">
                                  Open Terminal and run:
                                </p>
                                <code className="text-xs break-all">
                                  sudo dscacheutil -flushcache; sudo killall
                                  -HUP mDNSResponder
                                </code>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Enter your password when prompted.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="font-medium">4. Test with VPN</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            If the site loads with a VPN, it confirms the issue
                            is with your ISP's DNS or routing.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary/10 p-3 rounded-md mt-4 border border-primary/20">
                    <p className="font-medium mb-1">Why does this happen?</p>
                    <p className="text-xs text-muted-foreground">
                      .vip domains are sometimes poorly resolved by certain ISPs
                      or private DNS servers. Switching to public DNS
                      (Cloudflare 1.1.1.1 or Google 8.8.8.8) usually fixes the
                      issue immediately.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="vibetrader-features">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>What is Vibe Trader and how does it work?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <p>
                  <strong>Vibe Trader</strong> is a paper trading simulator that
                  uses <strong>real Hyperliquid Mainnet orderbook data</strong>{" "}
                  in real-time.
                </p>

                <div className="space-y-2 pl-4">
                  <div>
                    <strong>✓ Real Mainnet prices</strong>
                    <p className="text-muted-foreground text-xs">
                      Live orderbook from actual Hyperliquid Mainnet
                    </p>
                  </div>
                  <div>
                    <strong>✓ Real spread & liquidity</strong>
                    <p className="text-muted-foreground text-xs">
                      See actual bid/ask depth and realistic fills
                    </p>
                  </div>
                  <div>
                    <strong>✓ Zero risk</strong>
                    <p className="text-muted-foreground text-xs">
                      All trades are simulated; no real funds at risk
                    </p>
                  </div>
                  <div>
                    <strong>✓ Customizable balance</strong>
                    <p className="text-muted-foreground text-xs">
                      Set your starting capital (e.g., 10,000 USDC)
                    </p>
                  </div>
                </div>

                <div className="bg-muted p-3 rounded-md mt-3">
                  <p className="font-medium mb-1">How to use:</p>
                  <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
                    <li>
                      Visit{" "}
                      <code className="text-primary">
                        https://vibetrader.vip/
                      </code>
                    </li>
                    <li>Paper trading mode is active by default</li>
                    <li>
                      Click Settings (⚙️) to set your balance (e.g., 10,000 USDC)
                    </li>
                    <li>Add assets via "+ Add Ladder" (BTC, ETH, SOL, etc.)</li>
                    <li>
                      Click left side of ladder to buy, right side to sell
                    </li>
                  </ol>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
